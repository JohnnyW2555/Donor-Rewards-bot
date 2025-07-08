import { logger } from "../utils/logger.js"
import { getDatabase, saveDatabase } from "../utils/database.js"
import { MessageFlags } from "discord.js"

export const name = "interactionCreate"

export async function execute(interaction) {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName)

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`)
      return
    }

    try {
      await command.execute(interaction)
    } catch (error) {
      logger.error(`Error executing ${interaction.commandName}:`, error)

      const errorMessage = {
        content: "❌ There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      }

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage)
        } else {
          await interaction.reply(errorMessage)
        }
      } catch (followUpError) {
        logger.error("Error sending error message:", followUpError)
      }
    }
    return
  }

  // Handle button interactions
  if (interaction.isButton()) {
    // Button interactions are handled by the pagination system
    // The collectors in pagination.js will handle these automatically
    return
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    try {
      await handleModalSubmit(interaction)
    } catch (error) {
      logger.error("Error handling modal submit:", error)
      
      const errorMessage = {
        content: "❌ There was an error processing your input!",
        flags: MessageFlags.Ephemeral,
      }

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage)
        } else {
          await interaction.reply(errorMessage)
        }
      } catch (followUpError) {
        logger.error("Error sending modal error message:", followUpError)
      }
    }
    return
  }
}

async function handleModalSubmit(interaction) {
  const { customId } = interaction
  
  if (customId === 'lucky_numbers_modal') {
    const numbersInput = interaction.fields.getTextInputValue('lucky_numbers_input')
    const guildId = interaction.guildId
    const userId = interaction.user.id
    
    logger.info(`🎲 Modal submitted: Lucky numbers input="${numbersInput}" by user ${userId}`)
    
    // Parse the input
    const inputNumbers = numbersInput.split(',').map(n => n.trim()).filter(n => n)
    const validNumbers = []
    const errors = []
    
    for (const numStr of inputNumbers) {
      const num = parseInt(numStr)
      if (isNaN(num)) {
        errors.push(`"${numStr}" is not a valid number`)
      } else if (num < 1 || num > 50) {
        errors.push(`${num} must be between 1 and 50`)
      } else if (validNumbers.includes(num)) {
        errors.push(`${num} is duplicated`)
      } else {
        validNumbers.push(num)
      }
    }
    
    if (errors.length > 0) {
      await interaction.reply({
        content: `❌ **Invalid Input**\n\n${errors.join('\n')}\n\nPlease try again with numbers between 1-50, separated by commas.`,
        flags: MessageFlags.Ephemeral
      })
      return
    }
    
    if (validNumbers.length === 0) {
      await interaction.reply({
        content: "❌ **No Valid Numbers**\nPlease enter at least one number between 1-50.",
        flags: MessageFlags.Ephemeral
      })
      return
    }
    
    if (validNumbers.length > 5) {
      await interaction.reply({
        content: "❌ **Too Many Numbers**\nYou can only set up to 5 lucky numbers.",
        flags: MessageFlags.Ephemeral
      })
      return
    }
    
    // Save the numbers
    const db = getDatabase(guildId)
    if (!db.users[userId]) db.users[userId] = {}
    db.users[userId].luckyNumbers = validNumbers.sort((a, b) => a - b)
    saveDatabase(guildId, db)
    
    logger.info(`🎲 Lucky numbers saved for user ${userId}: ${validNumbers.join(', ')}`)
    
    await interaction.reply({
      content: `✅ **Lucky Numbers Set!**\nYour lucky numbers: **${validNumbers.join(', ')}**\n\nThese numbers will be used for future draws and games.`,
      flags: MessageFlags.Ephemeral
    })
  }
}

