# 💰 Geofencing App Cost & Memory Breakdown

This document outlines the infrastructure, database memory, and API costs associated with running your Geofencing Application in production at various scales. 

Because we architected the app to **overwrite** location pings instead of saving a new document every 5 seconds, your database memory consumption is incredibly small. A single employee only generates about **2 KB of data per day**.

## 📊 Database Memory & Cost Scaling Matrix

Here is the expected cost and memory usage based on your total employee count (assuming 22 working days a month):

| Metric | 100 Employees | 200 Employees | 1,000 Employees |
| :--- | :--- | :--- | :--- |
| **New Data Generated (Per Month)** | ~4.4 MB / month | ~8.8 MB / month | ~44.0 MB / month |
| **Time to fill Free Tier (512 MB)** | **~9.5 Years** | **~4.8 Years** | **~11 Months** |
| **Database Cost (MongoDB Atlas)** | **$0 / mo** (Free Tier) | **$15 / mo** | **$57 / mo** |
| **Server Traffic (Pings per sec)** | ~20 Requests / sec | ~40 Requests / sec | ~200 Requests / sec |
| **Server Hosting Cost (VPS)** | **$0 to $5 / mo** | **$5 to $7 / mo** | **$12 to $24 / mo** |
| **Map & Geolocation APIs** | **$0 / mo** (Free) | **$0 / mo** (Free) | **$0 to $5 / mo** (If OSM blocks high traffic) |
| **Total Estimated Monthly Cost** | **$0 to $5 / month** | **$5 to $7 / month** | **$21 to $38 / month** |

---

## 🛠️ Detailed Breakdown of Technologies

### 1. Database (MongoDB)
Every time an employee pings their location, the server **updates** their existing active Check-In document. It does not create a new one. 
Therefore, an employee only creates:
- 1 to 4 `CheckIn` documents per day (~250 bytes each)
- 1 `DailyLog` document per day (~1,000 bytes each)
**Total Memory Required**: Extremely low. MongoDB Atlas provides 512 MB completely free forever, which will easily host 200 employees for over 4 years without spending a single penny on databases.

### 2. Server Hosting (Docker Backend)
Your Node.js backend receives a ping from every active employee every 5 seconds. 
- At **100-200 users**, this is a very light load. A basic $5 Virtual Private Server (like a DigitalOcean Droplet with 1GB RAM) will handle this flawlessly.
- At **1,000 users**, your server is validating 200 GPS coordinates every single second. You will need a slightly stronger server (2GB to 4GB RAM) which costs between $12 and $24 per month.

### 3. Maps & Geolocation (Frontend)
- **OpenStreetMap (via Leaflet)**: 100% free. No Google API keys. At 1,000 users, the public OSM servers might throttle your map tiles, requiring a cheap $5/mo commercial tile subscription (like MapTiler).
- **GPS (expo-location)**: 100% free. The math is done natively on the employee's phone CPU.

### 4. Mobile App (Expo)
- **App Distribution**: Free to build Android `.apk` files. 
- **Note**: Official Play Store publishing is a one-time $25 fee to Google. iOS App Store is $99/year to Apple.

**Conclusion**: This app is heavily optimized for massive scale at almost no cost. Even at 1,000 enterprise employees, you can comfortably run the entire infrastructure for less than $40 a month.

---

## 📦 Data Payload & Storage Schema Breakdown

To understand exactly why the memory footprint is so small, here is the exact data (JSON payloads) being sent to and stored in your MongoDB database per user:

### 1. User Profile (Stored Once)
When an admin creates a new employee, this is the only data stored permanently for their account.
**Memory Size**: ~150 Bytes
```json
{
  "_id": "64a5c9...",
  "name": "John Doe",
  "password": "$2a$10$hashed_password_string...",
  "role": "employee",
  "employeeId": "EMP-X9B2"
}
```

### 2. Check-In Session (1 to 4 per day)
When an employee enters a geofence, a single `CheckIn` document is created. 
**The Secret**: When the phone pings every 5 seconds, it simply sends `{ latitude: 28.5, longitude: 77.3 }` to the server. The server **overwrites** the `lastLatitude`, `lastLongitude`, and `lastPingAt` fields on this exact same document. It does NOT create 5,000 documents a day!
**Memory Size**: ~200 Bytes
```json
{
  "_id": "64b9a1...",
  "userName": "John Doe",
  "locationId": "64a1b2...",
  "status": "active",
  "checkInAt": "2026-07-06T09:00:00.000Z",
  "checkOutAt": null,
  "lastPingAt": "2026-07-06T12:30:15.000Z",
  "lastLatitude": 28.53551,
  "lastLongitude": 77.39102
}
```

### 3. Daily Log Timeline (1 per day)
This document is created once per morning. Throughout the day, the server updates the `workedMinutes` math and pushes tiny event markers into the `events` array when the employee enters or exits the building.
**Memory Size**: ~500 to 1,000 Bytes (Depending on how many times they go in and out)
```json
{
  "_id": "64c8d3...",
  "userName": "John Doe",
  "date": "2026-07-06",
  "firstCheckIn": "2026-07-06T08:55:00.000Z",
  "lastCheckOut": "2026-07-06T18:05:00.000Z",
  "workedMinutes": 480,
  "lunchMinutes": 60,
  "unscheduledMinutes": 0,
  "flags": [
    "early_checkin", 
    "short_hours_half_day"
  ],
  "events": [
    {
      "type": "enter",
      "tag": "active",
      "time": "2026-07-06T08:55:00.000Z",
      "coords": { "latitude": 28.535, "longitude": 77.391 }
    },
    {
      "type": "exit",
      "tag": "lunch",
      "time": "2026-07-06T12:00:00.000Z",
      "coords": { "latitude": 28.536, "longitude": 77.392 }
    }
  ]
}
```

### Total Memory per Employee
Because the server is so smart about grouping everything into these 3 tiny documents:
- **Daily Memory Storage**: ~1,500 Bytes (1.5 KB) per employee.
- **Monthly Memory Storage**: ~33 Kilobytes (KB) per employee.

This is exactly why your database will survive for almost a decade on a free tier!
