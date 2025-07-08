import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js"
import { getDatabase } from "../utils/database.js"
import { logger } from "../utils/logger.js"
import { handleCategoryMenu, createPaginatedEmbeds, handlePagination } from "../utils/pagination.js"

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show comprehensive help information")
  .addStringOption(option =>
    option
      .setName("type")
      .setDescription("Type of help to show")
      .setRequired(false)
      .addChoices(
        { name: "User Commands", value: "user" },
        { name: "Admin Commands", value: "admin" }
      )
  )

export async function execute(interaction) {
  try {
    const serverId = interaction.guildId
    const db = getDatabase(serverId)
    const type = interaction.options.getString("type")
    
    // Check if user has admin permissions
    const isAdmin = await checkAdminPermissions(interaction, db)
    
    // If specific type requested, show that directly
    if (type === "admin" && !isAdmin) {
      return interaction.reply({
        content: "❌ You don't have permission to view admin commands.",
        flags: MessageFlags.Ephemeral
      })
    }
    
    if (type === "admin") {
      await showAdminHelp(interaction, db)
      return
    }
    
    if (type === "user") {
      await showUserHelp(interaction, db)
      return
    }

    // Create help menu
    const categories = [
      {
        id: "essential",
        name: "Essential",
        emoji: "🚀",
        description: "Core commands for donations and draws",
        generatePages: async () => await generateEssentialHelp(db)
      },
      {
        id: "user",
        name: "User Profile",
        emoji: "👤",
        description: "Profile, entries, and privacy commands",
        generatePages: async () => await generateUserHelp(db)
      },
      {
        id: "games",
        name: "Games & Fun",
        emoji: "🎮",
        description: "Lucky numbers, achievements, and leaderboards",
        generatePages: async () => await generateGamesHelp(db)
      },
      {
        id: "draws",
        name: "Draws",
        emoji: "🎁",
        description: "Draw information and leaderboards",
        generatePages: async () => await generateDrawsHelp(db)
      },
      {
        id: "about",
        name: "About",
        emoji: "ℹ️",
        description: "About the bot and how it works",
        generatePages: async () => await generateAboutHelp()
      }
    ]

    // Add admin category if user has permissions
    if (isAdmin) {
      categories.push({
        id: "admin",
        name: "Admin",
        emoji: "⚙️",
        description: "Administrative commands and tools",
        generatePages: async () => await generateAdminHelp(db)
      })
    }

    const menuData = {
      title: "🆘 Help - Donor Rewards Bot",
      description: "Complete command reference for the Donor Rewards Bot\n\n💡 **Quick Start:** Use `/donate` to get started with donations!",
      color: "#00BCD4",
      categories
    }

    await handleCategoryMenu(interaction, menuData, "help")
  } catch (error) {
    logger.error("Error in help command:", error)
    await interaction.reply({
      content: "❌ An error occurred while fetching help information.",
      flags: MessageFlags.Ephemeral
    })
  }
}

async function checkAdminPermissions(interaction, db) {
  const OWNER_ID = process.env.OWNER_ID || "659745190382141453"
  if (interaction.user.id === OWNER_ID) return true
  if (!db.config?.adminRoleId) return false

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id)
    return member.roles.cache.has(db.config.adminRoleId)
  } catch (error) {
    logger.error("Error checking admin permissions:", error)
    return false
  }
}

async function generateEssentialHelp(db) {
  const commands = [
    {
      name: "/donate",
      description: "Get donation instructions and accepted cryptocurrencies. Shows how to donate using tip.cc and which recipients are allowed."
    },
    {
      name: "/draws",
      description: "View active draws, leaderboards, and draw information. Interactive menu to explore all draw-related features."
    },
    {
      name: "/user",
      description: "Interactive user profile system. Access all user features through an interactive menu including entries, profile, privacy settings, and draw selection."
    },
    {
      name: "/price [symbol]",
      description: "Check current cryptocurrency prices. Supports all accepted donation currencies."
    },
    {
      name: "/ping",
      description: "Check bot status and response time. Useful for troubleshooting connection issues."
    }
  ]

  const pages = createPaginatedEmbeds(
    commands,
    4, // 4 commands per page
    (command) => ({
      name: `\`${command.name}\``,
      value: command.description,
      inline: false
    }),
    {
      title: "🚀 Essential Commands",
      description: "Core commands to get started with the Donor Rewards Bot",
      color: "#4CAF50",
      useFields: true,
      footerText: "Powered By Aegisum Eco System"
    }
  )

  return pages
}

async function generateUserHelp(db) {
  const commands = [
    {
      name: "/user",
      description: "🎯 **Interactive User Menu** - Access all user features through an interactive menu system with buttons and categories."
    },
    {
      name: "📊 Profile Category",
      description: "View your donation profile, statistics, achievements, and donation history. See total donated and progress."
    },
    {
      name: "🎟️ Draw Entries Category", 
      description: "Check your current entries across all active draws. See potential rewards and entry counts."
    },
    {
      name: "🎯 Select Draw Category",
      description: "Choose which draw your future donations count towards. Interactive buttons for each active draw."
    },
    {
      name: "🔒 Privacy Settings Category",
      description: "Toggle privacy settings with interactive buttons. Control who can see your profile and donations."
    },
    {
      name: "🏆 Achievements Category",
      description: "View your earned achievements and progress towards new ones. Interactive achievement browser."
    }
  ]

  const pages = createPaginatedEmbeds(
    commands,
    4, // 4 commands per page
    (command) => ({
      name: `\`${command.name}\``,
      value: command.description,
      inline: false
    }),
    {
      title: "👤 User Profile Commands",
      description: "Commands to manage your profile, entries, and privacy settings",
      color: "#2196F3",
      useFields: true,
      footerText: "Powered By Aegisum Eco System"
    }
  )

  return pages
}

async function generateGamesHelp(db) {
  const commands = [
    {
      name: "/lucky",
      description: "🍀 **Interactive Lucky Numbers** - Set lucky numbers with buttons, quick pick random numbers, or clear all numbers."
    },
    {
      name: "👀 View Lucky Numbers",
      description: "See your current lucky numbers and statistics. Shows total numbers set and range information."
    },
    {
      name: "🎯 Set Lucky Numbers",
      description: "Set your lucky numbers with interactive buttons. Quick pick for random selection or manual entry."
    },
    {
      name: "🗑️ Clear Lucky Numbers",
      description: "Clear all your lucky numbers with confirmation buttons. Includes cancel option for safety."
    },
    {
      name: "/achievements",
      description: "Interactive achievement browser. View available achievements, progress, and earned achievements."
    },
    {
      name: "/leaderboard",
      description: "Multiple leaderboards: donations, monthly, weekly, entries, achievements, and streaks."
    },
    {
      name: "/milestones",
      description: "View donation milestones and rewards for reaching certain amounts. Track your progress."
    },
    {
      name: "/referral",
      description: "Referral system to earn bonus entries when people you refer make donations."
    }
  ]

  const pages = createPaginatedEmbeds(
    commands,
    4, // 4 commands per page
    (command) => ({
      name: `\`${command.name}\``,
      value: command.description,
      inline: false
    }),
    {
      title: "🎮 Games & Fun Commands",
      description: "Interactive games and activities to earn more entries and rewards",
      color: "#FF9800",
      useFields: true,
      footerText: "Powered By Aegisum Eco System"
    }
  )

  return pages
}

async function generateDrawsHelp(db) {
  const commands = [
    {
      name: "/draws",
      description: "Interactive draw system. View active draws, leaderboards, completed draws, and draw IDs."
    },
    {
      name: "/draws [draw_id]",
      description: "Get detailed information about a specific draw by providing its ID."
    }
  ]

  const pages = createPaginatedEmbeds(
    commands,
    4, // 4 commands per page
    (command) => ({
      name: `\`${command.name}\``,
      value: command.description,
      inline: false
    }),
    {
      title: "🎁 Draw Commands",
      description: "Commands to view and interact with donation draws",
      color: "#9C27B0",
      useFields: true,
      footerText: "Powered By Aegisum Eco System"
    }
  )

  return pages
}

async function generateAdminHelp(db) {
  const commands = [
    {
      name: "/admin",
      description: "🛠️ **Interactive Admin Panel** - Complete administrative control through interactive menus and buttons."
    },
    {
      name: "⚙️ Bot Setup Category",
      description: "Configure admin roles, log channels, and notification channels with interactive buttons."
    },
    {
      name: "🎯 Manage Draws Category",
      description: "Create, edit, activate/deactivate draws with interactive buttons. Toggle draw status instantly."
    },
    {
      name: "📊 Dashboard Category",
      description: "View server statistics, user counts, donation totals, and system status."
    },
    {
      name: "📈 Analytics Category",
      description: "Detailed analytics with charts and reports. Track donations, users, and draw performance."
    },
    {
      name: "🚫 Blacklist Category",
      description: "Manage blacklisted users with interactive add/remove buttons. View current blacklist."
    },
    {
      name: "👥 User Management Category",
      description: "Manage user entries, assign manual entries, and view user statistics."
    },
    {
      name: "🔧 Features Category",
      description: "Toggle bot features on/off with interactive switches. Control available functionality."
    }
  ]

  const pages = createPaginatedEmbeds(
    commands,
    5, // 5 commands per page
    (command) => ({
      name: `\`${command.name}\``,
      value: command.description,
      inline: false
    }),
    {
      title: "⚙️ Admin Commands",
      description: "Administrative commands for bot management and configuration\n\n⚠️ **Note:** These commands require admin permissions.",
      color: "#F44336",
      useFields: true,
      footerText: "Powered By Aegisum Eco System"
    }
  )

  return pages
}

async function showUserHelp(interaction, db) {
  const pages = await generateUserHelp(db)
  await handlePagination(interaction, pages, "help_user")
}

async function showAdminHelp(interaction, db) {
  const pages = await generateAdminHelp(db)
  await handlePagination(interaction, pages, "help_admin")
}

async function generateAboutHelp() {
  const embed = new EmbedBuilder()
    .setTitle("ℹ️ About Donor Rewards Bot")
    .setDescription("**Welcome to the Donor Rewards Bot!**\n\nThis bot is designed to reward community members for their donations and create an engaging ecosystem around charitable giving.")
    .setColor("#00BCD4")
    .addFields(
      {
        name: "🎯 How It Works",
        value: [
          "• **Donate** to enter draws and earn rewards",
          "• **Automatic Detection** - Bot tracks tip.cc donations",
          "• **Draw Entries** - Get entries based on donation amount",
          "• **Lucky Numbers** - Set your lucky numbers for games",
          "• **Achievements** - Unlock rewards for milestones",
          "• **Leaderboards** - Compete with other donors"
        ].join("\n"),
        inline: false
      },
      {
        name: "🎁 Draw System",
        value: [
          "• Multiple draws with different reward tiers",
          "• Automatic entry based on donation amounts",
          "• Fair and transparent winner selection",
          "• Privacy controls for your entries",
          "• Real-time tracking and statistics"
        ].join("\n"),
        inline: false
      },
      {
        name: "🎮 Interactive Features",
        value: [
          "• **Interactive Menus** - Easy navigation with buttons",
          "• **Real-time Updates** - Live statistics and progress",
          "• **User Profiles** - Track your donation history",
          "• **Privacy Controls** - Manage your visibility",
          "• **Admin Tools** - Comprehensive management system"
        ].join("\n"),
        inline: false
      },
      {
        name: "🏆 Key Features",
        value: [
          "• Multi-currency support (AEGS, USD, etc.)",
          "• Automatic tip detection and processing",
          "• Achievement system with unlockable rewards",
          "• Referral system for community growth",
          "• Milestone tracking and celebrations",
          "• Comprehensive admin controls"
        ].join("\n"),
        inline: false
      },
      {
        name: "🚀 Getting Started",
        value: [
          "1. Use `/help` to explore all features",
          "2. Set up your profile with `/user`",
          "3. View active draws with `/draws`",
          "4. Start donating to enter draws!",
          "5. Track your progress and achievements"
        ].join("\n"),
        inline: false
      },
      {
        name: "👨‍💻 Credits",
        value: [
          "**Developer:** Daimondsteel259",
          "**Special Thanks:** To the community for feedback and support",
          "**Open Source:** Built with Discord.js and Node.js"
        ].join("\n"),
        inline: false
      }
    )
    .setFooter({ text: "Powered By Aegisum Eco System" })
    .setTimestamp()

  return [embed]
}
