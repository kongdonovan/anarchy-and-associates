// This is a placeholder utility. You should replace this with actual logic to fetch all registered slash commands from discordx if available.
// For now, you can manually maintain this list or use reflection if your framework supports it.

export function getAllSlashCommands() {
  return [
    { name: "help", description: "Show available commands and usage", usage: "help [command]" },
    { name: "staff list", description: "View all staff and their roles" },
    { name: "staff hire", description: "Hire a new staff member" },
    { name: "staff fire", description: "Remove a staff member from the team" },
    { name: "staff promote", description: "Promote a staff member to a specified rank" },
    { name: "staff demote", description: "Demote a staff member to a specified lower rank" },
    { name: "case info", description: "View case metadata and documents" },
    { name: "case close", description: "Close a case" },
    { name: "case assign", description: "Assign a case to a lawyer" },
    { name: "job list", description: "List all jobs" },
    { name: "job add", description: "Add a new job for applications" },
    { name: "job edit", description: "Edit an existing job" },
    // ...add all other commands here
  ];
}
