import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js"
import { getDatabase, saveDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"
import { handleCategoryMenu, createActionButtons } from "../utils/pagination.js"

export const data = new SlashCommandBuilder()
  .setName("lucky")
  .setDescription("Lucky number games and management")

export async function execute(interaction) {
  try {
    logger.info(`🎲 Lucky command executed by ${interaction.user.tag}`)
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    logger.info(`🎲 Database loaded for guild ${serverId}`)
    
    // Create interactive menu for lucky numbers
    const categories = [
      {
        id: "view_lucky",
        name: "View Lucky Numbers",
        emoji: "👀",
        description: "View your current lucky numbers",
        generatePages: async () => await generateViewLuckyNumbers(db, interaction.user)
      },
      {
        id: "set_lucky",
        name: "Set Lucky Numbers",
        emoji: "🎯",
        description: "Set or update your lucky numbers",
        generatePages: async () => await generateSetLuckyNumbers(db, interaction.user)
      },
      {
        id: "clear_lucky",
        name: "Clear Lucky Numbers",
        emoji: "🗑️",
        description: "Clear all your lucky numbers",
        generatePages: async () => await generateClearLuckyNumbers(db, interaction.user)
      }
    ]

    logger.info(`🎲 About to call handleCategoryMenu with ${categories.length} categories`)
    
    await handleCategoryMenu(interaction, {
      categories,
      title: "🍀 Lucky Numbers",
      description: "Manage your lucky numbers for draws and games",
      color: "#00FF00"
    }, "lucky")
    
    logger.info(`🎲 handleCategoryMenu completed successfully`)
  } catch (error) {
    logger.error("Error in lucky command:", error)
    
    const errorMessage = {
      content: "❌ An error occurred while managing lucky numbers.",
      flags: MessageFlags.Ephemeral,
    }

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    } catch (followUpError) {
      logger.error("Error sending lucky error message:", followUpError)
    }
  }
}

async function generateViewLuckyNumbers(db, user) {
  const userData = db.users?.[user.id] || {}
  const luckyNumbers = userData.luckyNumbers || []
  
  const embed = new EmbedBuilder()
    .setTitle("👀 Your Lucky Numbers")
    .setDescription(luckyNumbers.length > 0 ? 
      `Your current lucky numbers: **${luckyNumbers.join(", ")}**` : 
      "You haven't set any lucky numbers yet!")
    .setColor("#00FF00")
    .addFields(
      {
        name: "📊 Statistics",
        value: `Total Numbers: ${luckyNumbers.length}/5\nRange: 1-50`,
        inline: true
      }
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })

  return [embed]
}

async function generateSetLuckyNumbers(db, user) {
  const userData = db.users?.[user.id] || {}
  const luckyNumbers = userData.luckyNumbers || []
  
  const embed = new EmbedBuilder()
    .setTitle("🎯 Set Lucky Numbers")
    .setDescription("Set your lucky numbers for draws and games")
    .setColor("#FFD700")
    .addFields(
      {
        name: "Current Numbers",
        value: luckyNumbers.length > 0 ? luckyNumbers.join(", ") : "None set",
        inline: true
      },
      {
        name: "Instructions",
        value: "• Choose 1-5 numbers between 1-50\n• Use the buttons below or type numbers\n• Numbers must be unique",
        inline: false
      }
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })

  const actionButtons = createActionButtons([
    { id: "quick_pick", label: "Quick Pick (Random)", style: 1, emoji: "🎲" },
    { id: "manual_input", label: "Manual Input", style: 2, emoji: "✏️" },
    { id: "clear_all", label: "Clear All", style: 4, emoji: "🗑️" }
  ], "set_lucky")

  return {
    embeds: [embed],
    components: [actionButtons]
  }
}

async function generateClearLuckyNumbers(db, user) {
  const userData = db.users?.[user.id] || {}
  const luckyNumbers = userData.luckyNumbers || []
  
  const embed = new EmbedBuilder()
    .setTitle("🗑️ Clear Lucky Numbers")
    .setDescription("Are you sure you want to clear all your lucky numbers?")
    .setColor("#FF0000")
    .addFields(
      {
        name: "Current Numbers",
        value: luckyNumbers.length > 0 ? luckyNumbers.join(", ") : "None set",
        inline: true
      },
      {
        name: "⚠️ Warning",
        value: "This action cannot be undone!",
        inline: false
      }
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })

  const actionButtons = createActionButtons([
    { id: "confirm_clear", label: "Confirm Clear", style: 4, emoji: "✅" },
    { id: "cancel_clear", label: "Cancel", style: 2, emoji: "❌" }
  ], "clear_lucky")

  return {
    embeds: [embed],
    components: [actionButtons]
  }
}

// Old functions removed - now using interactive menu system