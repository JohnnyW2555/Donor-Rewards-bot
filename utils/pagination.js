import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js"
import { logger } from "./logger.js"
import { getDatabase, saveDatabase } from "./database.js"

/**
 * Create pagination buttons
 * @param {number} currentPage - Current page number (0-indexed)
 * @param {number} totalPages - Total number of pages
 * @param {string} customId - Custom ID prefix for buttons
 * @returns {ActionRowBuilder} - Action row with pagination buttons
 */
export function createPaginationButtons(currentPage, totalPages, customId) {
  const row = new ActionRowBuilder()

  // Previous button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${customId}_prev`)
      .setLabel("◀️ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0)
  )

  // Page indicator
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${customId}_page`)
      .setLabel(`${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true)
  )

  // Next button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${customId}_next`)
      .setLabel("Next ▶️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages - 1)
  )

  return row
}

/**
 * Create category selection buttons
 * @param {Array} categories - Array of category objects with {id, name, emoji}
 * @param {string} customId - Custom ID prefix for buttons
 * @returns {ActionRowBuilder[]} - Array of action rows with category buttons
 */
export function createCategoryButtons(categories, customId) {
  const rows = []
  const buttonsPerRow = 5
  
  for (let i = 0; i < categories.length; i += buttonsPerRow) {
    const row = new ActionRowBuilder()
    const categorySlice = categories.slice(i, i + buttonsPerRow)
    
    for (const category of categorySlice) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${customId}_${category.id}`)
          .setLabel(`${category.emoji} ${category.name}`)
          .setStyle(ButtonStyle.Primary)
      )
    }
    
    rows.push(row)
  }
  
  return rows
}

/**
 * Create action buttons for interactive settings
 * @param {Array} actions - Array of action objects with {id, label, style, emoji}
 * @param {string} customId - Custom ID prefix for buttons
 * @returns {ActionRowBuilder} - Action row with action buttons
 */
export function createActionButtons(actions, customId) {
  const row = new ActionRowBuilder()

  for (const action of actions) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${customId}_action_${action.id}`)
        .setLabel(action.label)
        .setStyle(action.style || ButtonStyle.Primary)
        .setEmoji(action.emoji || null)
        .setDisabled(action.disabled || false)
    )
  }

  return row
}

/**
 * Handle pagination interaction
 * @param {Object} interaction - Discord interaction
 * @param {Array} pages - Array of embed pages
 * @param {string} customId - Custom ID prefix
 * @param {number} timeout - Timeout in milliseconds
 */
export async function handlePagination(interaction, pages, customId, timeout = 60000) {
  if (pages.length === 0) {
    return interaction.reply({ content: "❌ No data to display.", flags: MessageFlags.Ephemeral })
  }

  if (pages.length === 1) {
    return interaction.reply({ embeds: [pages[0]] })
  }

  let currentPage = 0
  const totalPages = pages.length

  const row = createPaginationButtons(currentPage, totalPages, customId)
  
  const response = await interaction.reply({
    embeds: [pages[currentPage]],
    components: [row]
  }).then(() => interaction.fetchReply())

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout
  })

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      return buttonInteraction.reply({
        content: "❌ You can't use these buttons.",
        flags: MessageFlags.Ephemeral
      })
    }

    const action = buttonInteraction.customId.split('_').pop()

    switch (action) {
      case 'prev':
        currentPage = Math.max(0, currentPage - 1)
        break
      case 'next':
        currentPage = Math.min(totalPages - 1, currentPage + 1)
        break
      default:
        return
    }

    const newRow = createPaginationButtons(currentPage, totalPages, customId)
    
    await buttonInteraction.update({
      embeds: [pages[currentPage]],
      components: [newRow]
    })
  })

  collector.on('end', async () => {
    try {
      const disabledRow = createPaginationButtons(currentPage, totalPages, customId)
      disabledRow.components.forEach(button => button.setDisabled(true))
      
      await response.edit({
        embeds: [pages[currentPage]],
        components: [disabledRow]
      })
    } catch (error) {
      logger.error("Error disabling pagination buttons:", error)
    }
  })
}

/**
 * Create paginated embeds from data array
 * @param {Array} data - Array of data items
 * @param {number} itemsPerPage - Number of items per page
 * @param {Function} formatItem - Function to format each item
 * @param {Object} embedOptions - Base embed options
 * @returns {Array} - Array of embed pages
 */
export function createPaginatedEmbeds(data, itemsPerPage, formatItem, embedOptions) {
  const pages = []
  const totalPages = Math.ceil(data.length / itemsPerPage)

  for (let i = 0; i < totalPages; i++) {
    const start = i * itemsPerPage
    const end = start + itemsPerPage
    const pageData = data.slice(start, end)

    const embed = new EmbedBuilder()
      .setTitle(embedOptions.title || "Data")
      .setColor(embedOptions.color || "#4CAF50")
      .setFooter({ 
        text: `${embedOptions.footerText || "Powered By Aegisum Eco System"} • Page ${i + 1}/${totalPages}` 
      })

    if (embedOptions.description) {
      embed.setDescription(embedOptions.description)
    }

    if (embedOptions.thumbnail) {
      embed.setThumbnail(embedOptions.thumbnail)
    }

    // Format items for this page
    const formattedItems = pageData.map(formatItem)
    
    if (embedOptions.useFields) {
      // Add as fields
      for (const item of formattedItems) {
        embed.addFields(item)
      }
    } else {
      // Add as description content
      const content = formattedItems.join('\n')
      embed.setDescription((embedOptions.description || '') + '\n\n' + content)
    }

    pages.push(embed)
  }

  return pages
}

/**
 * Create a menu system with categories and pagination
 * @param {Object} interaction - Discord interaction
 * @param {Object} menuData - Menu configuration
 * @param {string} customId - Custom ID prefix
 * @param {number} timeout - Timeout in milliseconds
 */
export async function handleCategoryMenu(interaction, menuData, customId, timeout = 60000) {
  const { categories, title, description, color } = menuData

  // Create main menu embed
  const mainEmbed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color || "#4CAF50")
    .setFooter({ text: "Powered By Aegisum Eco System" })

  // Add category overview
  let categoryList = ""
  for (const category of categories) {
    categoryList += `${category.emoji} **${category.name}** - ${category.description}\n`
  }
  mainEmbed.addFields({ name: "📋 Categories", value: categoryList, inline: false })

  // Create category buttons
  const categoryRows = createCategoryButtons(categories, customId)

  const response = await interaction.reply({
    embeds: [mainEmbed],
    components: categoryRows
  }).then(() => interaction.fetchReply())

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout
  })

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      return buttonInteraction.reply({
        content: "❌ You can't use these buttons.",
        flags: MessageFlags.Ephemeral
      })
    }

    const categoryId = buttonInteraction.customId.replace(`${customId}_`, '')
    const category = categories.find(cat => cat.id === categoryId)

    if (!category) return

    // Generate category content
    const categoryData = await category.generatePages()
    
    // Handle both array format (embeds) and object format (embeds + components)
    let categoryPages, categoryComponents = []
    
    if (Array.isArray(categoryData)) {
      categoryPages = categoryData
    } else if (categoryData.embeds) {
      categoryPages = categoryData.embeds
      categoryComponents = categoryData.components || []
    } else {
      return buttonInteraction.reply({
        content: `❌ No data available for ${category.name}.`,
        flags: MessageFlags.Ephemeral
      })
    }
    
    if (categoryPages.length === 0) {
      return buttonInteraction.reply({
        content: `❌ No data available for ${category.name}.`,
        flags: MessageFlags.Ephemeral
      })
    }

    // Handle pagination for this category
    let currentPage = 0
    const totalPages = categoryPages.length

    const updateCategoryView = async (page) => {
      const embed = categoryPages[page]
      const components = [...categoryComponents] // Copy category-specific components

      // Add pagination if multiple pages
      if (totalPages > 1) {
        const paginationRow = createPaginationButtons(page, totalPages, `${customId}_cat`)
        components.push(paginationRow)
      }

      // Add back button
      const backRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`${customId}_back`)
            .setLabel("🔙 Back to Menu")
            .setStyle(ButtonStyle.Secondary)
        )
      components.push(backRow)

      return { embeds: [embed], components }
    }

    try {
      logger.info("🔧 About to update category view...")
      await buttonInteraction.update(await updateCategoryView(currentPage))
      logger.info("🔧 Successfully updated category view")
    } catch (updateError) {
      logger.error("❌ Failed to update category view:", updateError.message)
      // If update fails, try to reply instead
      try {
        if (!buttonInteraction.replied) {
          await buttonInteraction.reply(await updateCategoryView(currentPage))
        }
      } catch (replyError) {
        logger.error("❌ Failed to reply with category view:", replyError.message)
      }
    }

    // Handle category pagination
    const categoryCollector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: timeout
    })

    categoryCollector.on('collect', async (catInteraction) => {
      if (catInteraction.user.id !== interaction.user.id) {
        return catInteraction.reply({
          content: "❌ You can't use these buttons.",
          flags: MessageFlags.Ephemeral
        })
      }

      const customIdParts = catInteraction.customId.split('_')
      const action = customIdParts[customIdParts.length - 1]
      const actionType = customIdParts[customIdParts.length - 2]

      // Handle action buttons (privacy, draw selection, etc.)
      if (actionType === 'action') {
        await handleActionButton(catInteraction, catInteraction.customId, category, action, interaction.guildId)
        
        // Refresh the category view
        const refreshedData = await category.generatePages()
        let refreshedPages, refreshedComponents = []
        
        if (Array.isArray(refreshedData)) {
          refreshedPages = refreshedData
        } else if (refreshedData.embeds) {
          refreshedPages = refreshedData.embeds
          refreshedComponents = refreshedData.components || []
        }
        
        if (refreshedPages && refreshedPages.length > 0) {
          const embed = refreshedPages[currentPage]
          const components = [...refreshedComponents]
          
          if (refreshedPages.length > 1) {
            const paginationRow = createPaginationButtons(currentPage, refreshedPages.length, `${customId}_cat`)
            components.push(paginationRow)
          }
          
          const backRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`${customId}_back`)
                .setLabel("🔙 Back to Menu")
                .setStyle(ButtonStyle.Secondary)
            )
          components.push(backRow)
          
          await catInteraction.update({ embeds: [embed], components })
        }
        return
      }

      if (action === 'back') {
        // Return to main menu
        await catInteraction.update({
          embeds: [mainEmbed],
          components: categoryRows
        })
        categoryCollector.stop()
        return
      }

      if (action === 'prev') {
        currentPage = Math.max(0, currentPage - 1)
      } else if (action === 'next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1)
      }

      await catInteraction.update(await updateCategoryView(currentPage))
    })
  })

  collector.on('end', async () => {
    try {
      // Disable all buttons
      const disabledRows = categoryRows.map(row => {
        const newRow = new ActionRowBuilder()
        row.components.forEach(button => {
          newRow.addComponents(ButtonBuilder.from(button).setDisabled(true))
        })
        return newRow
      })

      await response.edit({
        embeds: [mainEmbed],
        components: disabledRows
      })
    } catch (error) {
      logger.error("Error disabling category menu buttons:", error)
    }
  })
}

/**
 * Handle action button interactions
 * @param {Object} interaction - Button interaction
 * @param {string} customId - Custom ID prefix
 * @param {Object} category - Category object
 * @param {string} action - Action ID
 * @param {string} guildId - Guild ID
 */
async function handleActionButton(interaction, customId, category, action, guildId) {
  try {
    logger.info(`🔧 Action button clicked: customId=${customId}, action=${action}, category=${category.id}`)
    
    const db = getDatabase(guildId)
    const userId = interaction.user.id
    
    logger.info(`🔧 Database loaded, userId=${userId}, db keys:`, Object.keys(db))
    
    // Initialize users object if needed
    if (!db.users) {
      db.users = {}
    }
    
    // Initialize user data if needed
    if (!db.users[userId]) {
      db.users[userId] = {
        totalDonated: 0,
        entries: {},
        donations: [],
        achievements: [],
        privacyEnabled: false,
        wins: 0,
        streak: { current: 0, longest: 0 }
      }
    }
    
    if (category.id === 'privacy' || customId.includes('user_privacy') || customId.includes('privacy')) {
      logger.info(`🔒 Privacy action detected: action=${action}`)
      if (action === 'toggle_privacy') {
        const oldValue = db.users[userId].privacyEnabled
        db.users[userId].privacyEnabled = !db.users[userId].privacyEnabled
        saveDatabase(guildId, db)
        
        logger.info(`🔒 Privacy toggled: ${oldValue} -> ${db.users[userId].privacyEnabled}`)
        
        await interaction.reply({
          content: `✅ Privacy settings ${db.users[userId].privacyEnabled ? 'enabled' : 'disabled'}!`,
          flags: MessageFlags.Ephemeral
        })
      }
    } else if (category.id === 'select_draw') {
      if (action === 'auto') {
        delete db.users[userId].selectedDraw
        saveDatabase(guildId, db)
        
        await interaction.reply({
          content: "✅ Draw selection set to automatic!",
          flags: MessageFlags.Ephemeral
        })
      } else {
        // Check if it's a valid draw ID
        logger.info(`🔧 Checking draw: action=${action}, exists=${!!db.donationDraws?.[action]}, active=${db.donationDraws?.[action]?.active}`)
        
        if (db.donationDraws && db.donationDraws[action] && db.donationDraws[action].active) {
          logger.info(`🔧 Valid draw found, setting selectedDraw to ${action}`)
          db.users[userId].selectedDraw = action
          saveDatabase(guildId, db)
          
          const drawName = db.donationDraws[action].name
          logger.info(`🔧 About to reply with success message for draw: ${drawName}`)
          
          await interaction.reply({
            content: `✅ Selected draw: **${drawName}**!`,
            flags: MessageFlags.Ephemeral
          })
          
          logger.info(`🔧 Successfully replied with draw selection`)
        } else {
          logger.error(`🔧 Draw validation failed:`)
          logger.error(`  - action: ${action}`)
          logger.error(`  - db.donationDraws exists: ${!!db.donationDraws}`)
          logger.error(`  - draw exists: ${!!db.donationDraws?.[action]}`)
          logger.error(`  - draw active: ${db.donationDraws?.[action]?.active}`)
          logger.error(`  - available draws:`, Object.keys(db.donationDraws || {}))
          logger.error(`  - draw details:`, db.donationDraws?.[action])
          
          await interaction.reply({
            content: "❌ Invalid draw selection! Please try again.",
            flags: MessageFlags.Ephemeral
          })
        }
      }
    } else if (category.id === 'setup') {
      // Handle admin setup actions
      if (action === 'set_admin_role') {
        await interaction.reply({
          content: "🛡️ **Set Admin Role**\n\nTo set the admin role, please mention the role you want to use as admin role.\n\nExample: `@Admin` or `@Moderator`\n\n*This feature will be fully interactive in the next update.*",
          flags: MessageFlags.Ephemeral
        })
      } else if (action === 'set_log_channel') {
        await interaction.reply({
          content: "📝 **Set Log Channel**\n\nTo set the log channel, please mention the channel you want to use for logs.\n\nExample: `#bot-logs` or `#admin-logs`\n\n*This feature will be fully interactive in the next update.*",
          flags: MessageFlags.Ephemeral
        })
      } else if (action === 'set_notification_channel') {
        await interaction.reply({
          content: "📢 **Set Notification Channel**\n\nTo set the notification channel, please mention the channel you want to use for notifications.\n\nExample: `#announcements` or `#notifications`\n\n*This feature will be fully interactive in the next update.*",
          flags: MessageFlags.Ephemeral
        })
      }
    } else if (category.id === 'set_lucky' || category.id === 'clear_lucky') {
      // Handle lucky number actions
      if (action === 'quick_pick') {
        // Generate 5 random numbers between 1-50
        const randomNumbers = []
        while (randomNumbers.length < 5) {
          const num = Math.floor(Math.random() * 50) + 1
          if (!randomNumbers.includes(num)) {
            randomNumbers.push(num)
          }
        }
        
        if (!db.users[userId]) db.users[userId] = {}
        db.users[userId].luckyNumbers = randomNumbers.sort((a, b) => a - b)
        saveDatabase(guildId, db)
        
        await interaction.reply({
          content: `🎲 **Quick Pick Complete!**\nYour new lucky numbers: **${randomNumbers.join(", ")}**`,
          flags: MessageFlags.Ephemeral
        })
      } else if (action === 'clear_all' || action === 'confirm_clear') {
        if (!db.users[userId]) db.users[userId] = {}
        db.users[userId].luckyNumbers = []
        saveDatabase(guildId, db)
        
        await interaction.reply({
          content: "🗑️ **Lucky numbers cleared!**\nAll your lucky numbers have been removed.",
          flags: MessageFlags.Ephemeral
        })
      } else if (action === 'cancel_clear') {
        await interaction.reply({
          content: "❌ **Cancelled**\nYour lucky numbers were not cleared.",
          flags: MessageFlags.Ephemeral
        })
      } else if (action === 'manual_input') {
        // Show modal for manual input
        const modal = new ModalBuilder()
          .setCustomId('lucky_numbers_modal')
          .setTitle('Set Lucky Numbers')
        
        const numbersInput = new TextInputBuilder()
          .setCustomId('lucky_numbers_input')
          .setLabel('Enter your lucky numbers (1-50)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Example: 7, 13, 21, 35, 42')
          .setRequired(true)
          .setMaxLength(50)
        
        const firstActionRow = new ActionRowBuilder().addComponents(numbersInput)
        modal.addComponents(firstActionRow)
        
        await interaction.showModal(modal)
        return // Don't continue with normal processing
      }
    } else if (category.id === 'draws') {
      // Handle draw management actions
      if (action.startsWith('toggle_')) {
        const drawId = action.replace('toggle_', '')
        if (db.donationDraws && db.donationDraws[drawId]) {
          db.donationDraws[drawId].active = !db.donationDraws[drawId].active
          db.donationDraws[drawId].lastModified = Date.now()
          db.donationDraws[drawId].modifiedBy = userId
          saveDatabase(guildId, db)
          
          const status = db.donationDraws[drawId].active ? 'activated' : 'deactivated'
          await interaction.reply({
            content: `✅ Draw **${db.donationDraws[drawId].name}** has been ${status}!`,
            flags: MessageFlags.Ephemeral
          })
        } else {
          await interaction.reply({
            content: "❌ Draw not found!",
            flags: MessageFlags.Ephemeral
          })
        }
      } else if (action === 'create_draw') {
        await interaction.reply({
          content: "🎯 **Create New Draw**\n\nTo create a new draw, you'll need to provide:\n• Draw name\n• Minimum donation amount\n• Maximum donation amount\n• Reward description\n• Maximum entries\n\n*Full draw creation interface coming soon!*",
          flags: MessageFlags.Ephemeral
        })
      }
    }
  } catch (error) {
    logger.error("❌ CRITICAL ERROR in handleActionButton:")
    logger.error("Error message:", error.message)
    logger.error("Error stack:", error.stack)
    logger.error("Action details:", { 
      customId, 
      categoryId: category?.id, 
      action, 
      guildId,
      userId: interaction?.user?.id,
      interactionReplied: interaction?.replied,
      interactionDeferred: interaction?.deferred
    })
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        logger.info("🔧 Attempting to reply with error message...")
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          flags: MessageFlags.Ephemeral
        })
        logger.info("🔧 Successfully sent error reply")
      } else {
        logger.info("🔧 Attempting to followUp with error message...")
        await interaction.followUp({
          content: "❌ An error occurred while processing your request.",
          flags: MessageFlags.Ephemeral
        })
        logger.info("🔧 Successfully sent error followUp")
      }
    } catch (followUpError) {
      logger.error("❌ FAILED to send error response:", followUpError.message)
      logger.error("FollowUp error stack:", followUpError.stack)
    }
  }
}