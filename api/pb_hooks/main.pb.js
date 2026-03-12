// pb_hooks/main.pb.js

// Custom routes
// routerAdd("GET", "/api/custom/example", (e) => {
//     return e.json(200, { message: "Hello" })
// })

// Database hooks
// onRecordCreate((e) => {
//     if (e.collection.name === "example") {
//         console.log("Record created:", e.record.id)
//     }
//     return e.next()
// })

// Cron jobs
// cronAdd("dailyTask", "0 3 * * *", () => {
//     console.log("Running daily task...")
// })

// Instructions:
// Make sure to organize hooks in files under the `api/pb_hooks/` directory.
// Each file can contain custom routes, database hooks, and cron jobs as needed.