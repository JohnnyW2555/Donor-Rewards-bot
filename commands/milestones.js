import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js"
import { getDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"
import { handleCategoryMenu, createPaginatedEmbeds } from "../utils/pagination.js"

export const data = new SlashCommandBuilder()
  .setName("milestones")
  .setDescription("View donation milestones and progress")

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    const userId = interaction.user.id

    logger.info(`Milestones command executed by ${interaction.user.tag}`)

    // Create milestones menu
    const menuData = {
      title: "🏆 Donation Milestones",
      description: "Track your donation progress and unlock rewards!",
      color: "#FFD700",
      categories: [
        {
          id: "progress",
          name: "My Progress",
          emoji: "📈",
          description: "View your current milestone progress",
          generatePages: async () => await generateProgressPages(db, userId, interaction.guild)
        },
        {
          id: "milestones",
          name: "All Milestones",
          emoji: "🎯",
          description: "View all available milestones and rewards",
          generatePages: async () => await generateMilestonesPages(db)
        },
        {
          id: "rewards",
          name: "Rewards",
          emoji: "🎁",
          description: "View milestone rewards and achievements",
          generatePages: async () => await generateRewardsPages(db, userId)
        },
        {
          id: "leaderboard",
          name: "Leaderboard",
          emoji: "🏆",
          description: "See top milestone achievers",
          generatePages: async () => await generateMilestoneLeaderboard(db, interaction.guild)
        }
      ]
    }

    await handleCategoryMenu(interaction, menuData, "milestones")
  } catch (error) {
    logger.error("Error in milestones command:", error)
    
    const errorMessage = {
      content: "❌ An error occurred while fetching milestone information.",
      flags: MessageFlags.Ephemeral,
    }

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    } catch (followUpError) {
      logger.error("Error sending milestones error message:", followUpError)
    }
  }
}

const MILESTONES = [
  { amount: 1, reward: "First Donor Badge", description: "Welcome to the community!" },
  { amount: 5, reward: "Bronze Supporter", description: "Thank you for your support!" },
  { amount: 10, reward: "Consistent Donor", description: "You're making a difference!" },
  { amount: 25, reward: "Silver Supporter", description: "Your generosity is appreciated!" },
  { amount: 50, reward: "Gold Supporter", description: "You're a valued community member!" },
  { amount: 100, reward: "Platinum Supporter", description: "Your dedication is inspiring!" },
  { amount: 250, reward: "Diamond Supporter", description: "You're a pillar of the community!" },
  { amount: 500, reward: "Elite Donor", description: "Your impact is immeasurable!" },
  { amount: 1000, reward: "Legendary Benefactor", description: "You're a true legend!" },
  { amount: 2500, reward: "Ultimate Patron", description: "Your legacy will be remembered!" }
]

async function generateProgressPages(db, userId, guild) {
  const userData = db.users?.[userId]
  
  if (!userData) {
    const embed = new EmbedBuilder()
      .setTitle("📈 Your Milestone Progress")
      .setDescription("❌ You haven't made any donations yet.\n\nMake your first donation to start tracking milestones!")
      .setColor("#F44336")
      .addFields({
        name: "🚀 Get Started",
        value: [
          "• Use `/donate` to make your first donation",
          "• Donations are automatically tracked",
          "• Unlock rewards as you reach milestones",
          "• View your progress anytime with this command"
        ].join("\n"),
        inline: false
      })
      .setFooter({ text: "Powered By Aegisum Eco System" })
    return [embed]
  }

  const totalDonated = userData.totalDonated || 0
  
  // Find current and next milestone
  let currentMilestone = null
  let nextMilestone = null

  for (const milestone of MILESTONES) {
    if (totalDonated >= milestone.amount) {
      currentMilestone = milestone
    } else if (!nextMilestone) {
      nextMilestone = milestone
      break
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("📈 Your Milestone Progress")
    .setDescription(`**Total Donated:** $${totalDonated.toFixed(2)}`)
    .setColor("#FF9800")

  if (currentMilestone) {
    embed.addFields({
      name: "🏅 Current Milestone",
      value: `**${currentMilestone.reward}**\n💰 $${currentMilestone.amount}\n${currentMilestone.description}`,
      inline: true,
    })
  }

  if (nextMilestone) {
    const needed = nextMilestone.amount - totalDonated
    const progress = (totalDonated / nextMilestone.amount) * 100
    const progressBar = createProgressBar(progress)
    
    embed.addFields({
      name: "🎯 Next Milestone",
      value: `**${nextMilestone.reward}**\n💰 $${nextMilestone.amount}\nNeed: $${needed.toFixed(2)} more\n\n${progressBar} ${progress.toFixed(1)}%`,
      inline: true,
    })
  } else {
    embed.addFields({
      name: "🎉 All Complete!",
      value: "You've completed all available milestones!\n\nYou're a true legend! 🏆",
      inline: true,
    })
  }

  // Show completed milestones
  const completedMilestones = MILESTONES.filter(m => totalDonated >= m.amount)
  const completedText = completedMilestones.length > 0 
    ? completedMilestones.map(m => `✅ ${m.reward} ($${m.amount})`).join("\n")
    : "None yet - start donating to unlock rewards!"

  embed.addFields({
    name: `🏆 Completed Milestones (${completedMilestones.length}/${MILESTONES.length})`,
    value: completedText,
    inline: false,
  })

  embed.setFooter({ text: "Powered By Aegisum Eco System" })
  return [embed]
}

async function generateMilestonesPages(db) {
  const pages = createPaginatedEmbeds(
    MILESTONES,
    5, // 5 milestones per page
    (milestone) => {
      return {
        name: `💰 $${milestone.amount} - ${milestone.reward}`,
        value: `${milestone.description}\n\n🎁 **Reward Benefits:**\n• Special Discord role\n• Exclusive recognition\n• Bonus draw entries`,
        inline: false
      }
    },
    {
      title: "🎯 All Donation Milestones",
      description: "Reach these donation amounts to unlock special rewards and recognition!",
      color: "#4CAF50",
      useFields: true,
      footerText: "Powered By Aegisum Eco System"
    }
  )

  return pages
}

async function generateRewardsPages(db, userId) {
  const userData = db.users?.[userId]
  const totalDonated = userData?.totalDonated || 0

  const embed = new EmbedBuilder()
    .setTitle("🎁 Milestone Rewards")
    .setDescription("Special rewards and benefits for reaching donation milestones")
    .setColor("#E91E63")

  let rewardsText = ""
  for (const milestone of MILESTONES) {
    const status = totalDonated >= milestone.amount ? "✅ UNLOCKED" : "🔒 Locked"
    const statusColor = totalDonated >= milestone.amount ? "**" : ""
    
    rewardsText += `${status} ${statusColor}$${milestone.amount} - ${milestone.reward}${statusColor}\n`
  }

  embed.addFields({
    name: "🏆 All Milestone Rewards",
    value: rewardsText,
    inline: false,
  })

  embed.addFields({
    name: "💎 Reward Benefits",
    value: [
      "🎭 **Special Discord Roles** - Show off your donor status",
      "🔑 **Exclusive Access** - VIP channels and features", 
      "🎟️ **Bonus Entries** - Extra chances in special draws",
      "⭐ **Recognition** - Featured in donor spotlights",
      "🚀 **Early Access** - First to know about new features",
      "🏆 **Leaderboard Status** - Top donor rankings",
      "🎨 **Custom Perks** - Unique benefits per milestone"
    ].join("\n"),
    inline: false,
  })

  const unlockedCount = MILESTONES.filter(m => totalDonated >= m.amount).length
  embed.addFields({
    name: "📊 Your Progress",
    value: `**${unlockedCount}/${MILESTONES.length}** milestones unlocked\n**$${totalDonated.toFixed(2)}** total donated`,
    inline: false,
  })

  embed.setFooter({ text: "Powered By Aegisum Eco System" })
  return [embed]
}

async function generateMilestoneLeaderboard(db, guild) {
  const users = Object.entries(db.users || {})
    .filter(([userId, userData]) => !userData.privacyEnabled && userData.totalDonated > 0)
    .sort(([, a], [, b]) => (b.totalDonated || 0) - (a.totalDonated || 0))
    .slice(0, 15) // Top 15

  if (users.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle("🏆 Milestone Leaderboard")
      .setDescription("❌ No public donation data available.")
      .setColor("#F44336")
      .setFooter({ text: "Powered By Aegisum Eco System" })
    return [embed]
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 Top Milestone Achievers")
    .setDescription("Leaderboard of top donors and their milestone progress")
    .setColor("#FFD700")

  const leaderboardText = await Promise.all(
    users.map(async ([userId, userData], index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
      const totalDonated = userData.totalDonated || 0
      const completedMilestones = MILESTONES.filter(m => totalDonated >= m.amount).length
      
      // Find current milestone
      let currentMilestone = "No milestones"
      for (const milestone of MILESTONES) {
        if (totalDonated >= milestone.amount) {
          currentMilestone = milestone.reward
        }
      }
      
      // Get username safely
      let username = "Unknown User"
      try {
        const user = await guild.members.fetch(userId)
        username = user.user.username
      } catch {
        // Use user ID if can't fetch
        username = `User ${userId.slice(-4)}`
      }
      
      return `${medal} **${username}**\n💰 $${totalDonated.toFixed(2)} • 🏆 ${completedMilestones}/${MILESTONES.length} milestones\n🎖️ ${currentMilestone}`
    })
  )
  
  const finalLeaderboardText = leaderboardText.join("\n\n")

  embed.addFields({
    name: "📊 Top Donors",
    value: finalLeaderboardText,
    inline: false,
  })

  embed.addFields({
    name: "💡 Privacy Note",
    value: "Only users with public profiles are shown. Use `/user` to manage your privacy settings.",
    inline: false,
  })

  embed.setFooter({ text: "Powered By Aegisum Eco System" })
  return [embed]
}

function createProgressBar(percentage) {
  const totalBars = 10
  const filledBars = Math.round((percentage / 100) * totalBars)
  const emptyBars = totalBars - filledBars
  
  return "█".repeat(filledBars) + "░".repeat(emptyBars)
}