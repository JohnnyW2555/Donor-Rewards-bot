import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js"
import { getDatabase, saveDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"
import { handleCategoryMenu, createPaginatedEmbeds, createActionButtons } from "../utils/pagination.js"

export const data = new SlashCommandBuilder()
  .setName("referral")
  .setDescription("Manage referral system and earn rewards")

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    const userId = interaction.user.id

    logger.info(`Referral command executed by ${interaction.user.tag}`)

    // Create referral menu
    const menuData = {
      title: "🤝 Referral System",
      description: "Invite friends and earn rewards together!",
      color: "#9C27B0",
      categories: [
        {
          id: "my_code",
          name: "My Referral Code",
          emoji: "🔗",
          description: "Get your unique referral code",
          generatePages: async () => await generateMyCodePages(db, userId)
        },
        {
          id: "use_code",
          name: "Use Code",
          emoji: "🎯",
          description: "Enter a referral code to get bonuses",
          generatePages: async () => await generateUseCodePages(db, userId)
        },
        {
          id: "my_stats",
          name: "My Statistics",
          emoji: "📊",
          description: "View your referral statistics and rewards",
          generatePages: async () => await generateMyStatsPages(db, userId, interaction.guild)
        },
        {
          id: "leaderboard",
          name: "Leaderboard",
          emoji: "🏆",
          description: "Top referrers and their achievements",
          generatePages: async () => await generateReferralLeaderboard(db, interaction.guild)
        },
        {
          id: "rewards",
          name: "Rewards",
          emoji: "🎁",
          description: "View referral rewards and bonuses",
          generatePages: async () => await generateReferralRewards(db)
        }
      ]
    }

    await handleCategoryMenu(interaction, menuData, "referral")
  } catch (error) {
    logger.error("Error in referral command:", error)
    
    const errorMessage = {
      content: "❌ An error occurred while processing the referral command.",
      flags: MessageFlags.Ephemeral,
    }

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    } catch (followUpError) {
      logger.error("Error sending referral error message:", followUpError)
    }
  }
}

async function generateMyCodePages(db, userId) {
  // Initialize user data if needed
  if (!db.users) db.users = {}
  if (!db.users[userId]) {
    db.users[userId] = {
      totalDonated: 0,
      entries: {},
      donations: [],
      achievements: [],
      privacyEnabled: false,
      wins: 0,
      referrals: { referred: [], referredBy: null },
      luckyNumbers: [],
      milestones: [],
      streaks: { current: 0, longest: 0, lastDonation: null }
    }
  }

  // Generate referral code if not exists
  if (!db.users[userId].referralCode) {
    db.users[userId].referralCode = generateReferralCode(userId)
    // Note: We can't save here since this is a read-only function
  }

  const referralCode = db.users[userId].referralCode || generateReferralCode(userId)
  const referredCount = db.users[userId].referrals?.referred?.length || 0
  const bonusEntries = referredCount * 5

  const embed = new EmbedBuilder()
    .setTitle("🔗 Your Referral Code")
    .setDescription("Share this code with friends to earn rewards together!")
    .setColor("#4CAF50")
    .addFields(
      { name: "📋 Your Unique Code", value: `\`${referralCode}\``, inline: true },
      { name: "👥 Total Referrals", value: referredCount.toString(), inline: true },
      { name: "🎁 Bonus Entries Earned", value: bonusEntries.toString(), inline: true }
    )
    .addFields({
      name: "💡 How to Share",
      value: [
        "• Copy your code above",
        "• Share it with friends and family",
        "• They use `/referral` and enter your code",
        "• Both of you get rewards when they donate!"
      ].join("\n"),
      inline: false,
    })
    .addFields({
      name: "🎯 Referral Benefits",
      value: [
        "🎟️ **5 bonus entries** per successful referral",
        "🏆 **Achievement badges** for referral milestones",
        "⭐ **Leaderboard recognition** for top referrers",
        "🤝 **Community growth** - help expand our ecosystem"
      ].join("\n"),
      inline: false,
    })
    .setFooter({ text: "Powered By Aegisum Eco System" })

  const actionButtons = createActionButtons([
    { id: "copy_code", label: "Copy Code", style: 1, emoji: "📋" },
    { id: "share_tips", label: "Sharing Tips", style: 2, emoji: "💡" }
  ], "my_code")

  return {
    embeds: [embed],
    components: [actionButtons]
  }
}

async function generateUseCodePages(db, userId) {
  const userData = db.users?.[userId]
  
  // Check if user already used a referral code
  if (userData?.referrals?.referredBy) {
    const embed = new EmbedBuilder()
      .setTitle("🎯 Use Referral Code")
      .setDescription("❌ You have already used a referral code.")
      .setColor("#F44336")
      .addFields({
        name: "ℹ️ Already Referred",
        value: "You can only use one referral code per account. You're already part of the referral system!",
        inline: false
      })
      .addFields({
        name: "🎁 Your Benefits",
        value: [
          "• You received bonus entries on your first donation",
          "• Your referrer earned rewards for inviting you",
          "• You can still refer others with your own code!"
        ].join("\n"),
        inline: false
      })
      .setFooter({ text: "Powered By Aegisum Eco System" })
    
    return [embed]
  }

  const embed = new EmbedBuilder()
    .setTitle("🎯 Use Referral Code")
    .setDescription("Enter a friend's referral code to get bonus rewards!")
    .setColor("#9C27B0")
    .addFields({
      name: "💡 How It Works",
      value: [
        "• Get a referral code from a friend",
        "• Click the button below to enter it",
        "• Both you and your friend get rewards!",
        "• You can only use one code per account"
      ].join("\n"),
      inline: false,
    })
    .addFields({
      name: "🎁 Rewards for Using a Code",
      value: [
        "🎟️ **Bonus entries** on your first donation",
        "🤝 **Welcome bonus** for joining through referral",
        "⭐ **Special recognition** as a referred member",
        "🎯 **Community connection** with your referrer"
      ].join("\n"),
      inline: false,
    })
    .addFields({
      name: "🎯 Rewards for Your Referrer",
      value: [
        "🎟️ **5 bonus entries** in active draws",
        "🏆 **Achievement progress** towards referral milestones",
        "⭐ **Leaderboard points** for community building",
        "🎉 **Notification** about successful referral"
      ].join("\n"),
      inline: false,
    })
    .setFooter({ text: "Powered By Aegisum Eco System" })

  const actionButtons = createActionButtons([
    { id: "enter_code", label: "Enter Referral Code", style: 1, emoji: "🎯" },
    { id: "code_help", label: "Need Help?", style: 2, emoji: "❓" }
  ], "use_code")

  return {
    embeds: [embed],
    components: [actionButtons]
  }
}

async function generateMyStatsPages(db, userId, guild) {
  const userData = db.users?.[userId]

  if (!userData) {
    const embed = new EmbedBuilder()
      .setTitle("📊 Your Referral Statistics")
      .setDescription("❌ You haven't joined the referral system yet.")
      .setColor("#F44336")
      .addFields({
        name: "🚀 Get Started",
        value: [
          "• Use the **My Referral Code** section to get your code",
          "• Share your code with friends and family",
          "• Start earning rewards for successful referrals",
          "• Track your progress and achievements here"
        ].join("\n"),
        inline: false
      })
      .setFooter({ text: "Powered By Aegisum Eco System" })
    
    return [embed]
  }

  const referredCount = userData.referrals?.referred?.length || 0
  const referredBy = userData.referrals?.referredBy
  const bonusEntries = referredCount * 5

  let referrerName = "None"
  if (referredBy) {
    try {
      const referrer = await guild.members.fetch(referredBy)
      referrerName = referrer?.user.username || "Unknown User"
    } catch {
      referrerName = "Unknown User"
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("📊 Your Referral Statistics")
    .setDescription("Your referral activity and earned rewards")
    .setColor("#00BCD4")
    .addFields(
      { name: "👥 People Referred", value: referredCount.toString(), inline: true },
      { name: "🎁 Bonus Entries Earned", value: bonusEntries.toString(), inline: true },
      { name: "🔗 Referred By", value: referrerName, inline: true }
    )

  // Show referred users if any
  if (referredCount > 0) {
    const referredUsers = []
    for (const referredId of userData.referrals.referred) {
      try {
        const user = await guild.members.fetch(referredId)
        if (user) {
          referredUsers.push(user.user.username)
        }
      } catch {
        referredUsers.push("Unknown User")
      }
    }

    if (referredUsers.length > 0) {
      embed.addFields({
        name: "👥 Your Successful Referrals",
        value: referredUsers.slice(0, 10).join(", ") + (referredUsers.length > 10 ? ` and ${referredUsers.length - 10} more...` : ""),
        inline: false,
      })
    }
  }

  // Achievement progress
  const achievements = [
    { name: "First Referral", count: 1, emoji: "🥉" },
    { name: "Community Builder", count: 3, emoji: "🥈" },
    { name: "Influencer", count: 5, emoji: "🥇" },
    { name: "Ambassador", count: 10, emoji: "🏆" },
    { name: "Legend", count: 25, emoji: "👑" }
  ]

  const achievementText = achievements.map(achievement => {
    const status = referredCount >= achievement.count ? "✅" : "❌"
    const progress = referredCount >= achievement.count ? "UNLOCKED" : `${referredCount}/${achievement.count}`
    return `${status} ${achievement.emoji} **${achievement.name}** (${progress})`
  }).join("\n")

  embed.addFields({
    name: "🏆 Achievement Progress",
    value: achievementText,
    inline: false,
  })

  embed.addFields({
    name: "💡 Referral Tips",
    value: [
      "• Share your code in social media",
      "• Explain the benefits to friends",
      "• Help new users get started",
      "• Be active in the community"
    ].join("\n"),
    inline: false,
  })

  embed.setFooter({ text: "Powered By Aegisum Eco System" })
  return [embed]
}

async function generateReferralLeaderboard(db, guild) {
  const users = Object.entries(db.users || {})
    .map(([userId, userData]) => {
      const referralCount = userData.referrals?.referred?.length || 0
      return [userId, { ...userData, referralCount }]
    })
    .filter(([userId, userData]) => userData.referralCount > 0 && !userData.privacyEnabled)
    .sort(([, a], [, b]) => b.referralCount - a.referralCount)
    .slice(0, 15)

  if (users.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle("🏆 Referral Leaderboard")
      .setDescription("❌ No public referral data available yet.")
      .setColor("#F44336")
      .addFields({
        name: "🚀 Be the First!",
        value: [
          "• Get your referral code",
          "• Share it with friends",
          "• Start earning rewards",
          "• Climb the leaderboard!"
        ].join("\n"),
        inline: false
      })
      .setFooter({ text: "Powered By Aegisum Eco System" })
    
    return [embed]
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 Referral Leaderboard")
    .setDescription("Top community builders and their achievements")
    .setColor("#E91E63")

  const leaderboardText = await Promise.all(
    users.map(async ([userId, userData], index) => {
      try {
        const user = await guild.members.fetch(userId)
        const username = user?.user.username || "Unknown User"
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
        const bonusEntries = userData.referralCount * 5
        
        return `${medal} **${username}**\n🤝 ${userData.referralCount} referrals • 🎁 ${bonusEntries} bonus entries`
      } catch {
        return null
      }
    })
  )

  const validEntries = leaderboardText.filter(entry => entry !== null)
  
  embed.addFields({
    name: "🌟 Top Referrers",
    value: validEntries.join("\n\n") || "No data available",
    inline: false,
  })

  embed.addFields({
    name: "🎁 Referral Rewards",
    value: [
      "🎟️ **5 bonus entries** per successful referral",
      "🏆 **Achievement badges** for referral milestones",
      "⭐ **Leaderboard recognition** and community status",
      "🤝 **Community growth** - help expand our ecosystem"
    ].join("\n"),
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

async function generateReferralRewards(db) {
  const embed = new EmbedBuilder()
    .setTitle("🎁 Referral Rewards & Benefits")
    .setDescription("Comprehensive guide to referral system rewards")
    .setColor("#9C27B0")
    .addFields({
      name: "🎯 For Referring Someone",
      value: [
        "🎟️ **5 bonus entries** in all active draws",
        "🏆 **Achievement progress** towards referral milestones",
        "⭐ **Leaderboard points** for community recognition",
        "🎉 **Instant notification** when someone uses your code"
      ].join("\n"),
      inline: false,
    })
    .addFields({
      name: "🤝 For Using a Referral Code",
      value: [
        "🎁 **Welcome bonus** entries on first donation",
        "🤝 **Community connection** with your referrer",
        "⭐ **Special recognition** as a referred member",
        "🎯 **Exclusive benefits** for referred users"
      ].join("\n"),
      inline: false,
    })
    .addFields({
      name: "🏆 Achievement Milestones",
      value: [
        "🥉 **First Referral** (1 referral) - Welcome badge",
        "🥈 **Community Builder** (3 referrals) - Special role",
        "🥇 **Influencer** (5 referrals) - VIP perks",
        "🏆 **Ambassador** (10 referrals) - Elite status",
        "👑 **Legend** (25 referrals) - Ultimate recognition"
      ].join("\n"),
      inline: false,
    })
    .addFields({
      name: "💡 How to Maximize Rewards",
      value: [
        "📱 **Share on social media** - Reach more people",
        "💬 **Explain the benefits** - Help friends understand",
        "🎯 **Target active users** - Quality over quantity",
        "🤝 **Help new users** - Guide them through the process",
        "⭐ **Stay active** - Engaged referrers get more success"
      ].join("\n"),
      inline: false,
    })
    .setFooter({ text: "Powered By Aegisum Eco System" })

  return [embed]
}

function generateReferralCode(userId) {
  // Generate a 6-character code based on user ID
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  
  // Use user ID as seed for consistency
  let seed = parseInt(userId.slice(-8), 16) || 1
  
  for (let i = 0; i < 6; i++) {
    seed = (seed * 9301 + 49297) % 233280
    result += chars[seed % chars.length]
  }
  
  return result
}