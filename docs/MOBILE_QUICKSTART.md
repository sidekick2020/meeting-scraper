# Mobile Quick Start Guide

Get meetings showing in your iOS or Android app in 10 minutes!

## Prerequisites

- Back4app account with meeting data ([Sign up free](https://www.back4app.com/))
- Your Back4app credentials (Application ID and Client Key)

## Get Your Back4app Credentials

1. Go to [Back4app Dashboard](https://www.back4app.com/)
2. Select your app (or create one if needed)
3. Go to **App Settings > Security & Keys**
4. Copy your **Application ID** and **Client Key**

---

## iOS Quick Start (Swift)

### Step 1: Add ParseSwift Package

In Xcode:
1. Go to **File > Add Package Dependencies**
2. Enter: `https://github.com/parse-community/Parse-Swift.git`
3. Click **Add Package**

### Step 2: Initialize Parse

Add to your app's entry point:

```swift
import ParseSwift

@main
struct MyApp: App {
    init() {
        ParseSwift.initialize(
            applicationId: "YOUR_APP_ID",
            clientKey: "YOUR_CLIENT_KEY",
            serverURL: URL(string: "https://parseapi.back4app.com")!
        )
    }

    var body: some Scene {
        WindowGroup {
            MeetingsView()
        }
    }
}
```

### Step 3: Create the Meeting Model

```swift
import ParseSwift

struct Meeting: ParseObject {
    var objectId: String?
    var createdAt: Date?
    var updatedAt: Date?
    var ACL: ParseACL?
    var originalData: Data?

    // Meeting fields
    var name: String?
    var meetingType: String?      // AA, NA, Al-Anon, etc.
    var day: Int?                 // 0=Sunday, 6=Saturday
    var time: String?             // "19:00" format
    var address: String?
    var city: String?
    var state: String?
    var locationName: String?
    var isOnline: Bool?
    var onlineUrl: String?
    var latitude: Double?
    var longitude: Double?
}
```

### Step 4: Display Meetings

```swift
import SwiftUI

struct MeetingsView: View {
    @State private var meetings: [Meeting] = []
    @State private var isLoading = true

    var body: some View {
        NavigationView {
            Group {
                if isLoading {
                    ProgressView("Loading meetings...")
                } else {
                    List(meetings, id: \.objectId) { meeting in
                        VStack(alignment: .leading) {
                            Text(meeting.name ?? "Meeting")
                                .font(.headline)
                            Text("\(meeting.city ?? ""), \(meeting.state ?? "")")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Meetings")
        }
        .task {
            await loadMeetings()
        }
    }

    func loadMeetings() async {
        do {
            meetings = try await Meeting.query()
                .limit(100)
                .order([.ascending("day"), .ascending("time")])
                .find()
            isLoading = false
        } catch {
            print("Error: \(error)")
            isLoading = false
        }
    }
}
```

### Common iOS Queries

```swift
// Filter by state
let caMeetings = try await Meeting.query("state" == "CA").find()

// Filter by day (0=Sunday)
let mondayMeetings = try await Meeting.query("day" == 1).find()

// AA meetings only
let aaMeetings = try await Meeting.query("meetingType" == "AA").find()

// Online meetings
let onlineMeetings = try await Meeting.query("isOnline" == true).find()

// Search by name
let results = try await Meeting.query("name" =~ "Serenity").find()
```

---

## Android Quick Start (Kotlin)

### Step 1: Add Dependencies

In `settings.gradle`:
```groovy
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}
```

In `app/build.gradle`:
```groovy
dependencies {
    implementation 'com.github.parse-community.Parse-SDK-Android:parse:1.26.0'
}
```

### Step 2: Initialize Parse

Create `App.kt`:

```kotlin
import android.app.Application
import com.parse.Parse
import com.parse.ParseObject

class App : Application() {
    override fun onCreate() {
        super.onCreate()

        ParseObject.registerSubclass(Meeting::class.java)

        Parse.initialize(
            Parse.Configuration.Builder(this)
                .applicationId("YOUR_APP_ID")
                .clientKey("YOUR_CLIENT_KEY")
                .server("https://parseapi.back4app.com/")
                .build()
        )
    }
}
```

Register in `AndroidManifest.xml`:
```xml
<application android:name=".App" ...>
```

### Step 3: Create the Meeting Model

```kotlin
import com.parse.ParseClassName
import com.parse.ParseObject

@ParseClassName("Meeting")
class Meeting : ParseObject() {
    var name: String?
        get() = getString("name")
        set(value) = put("name", value ?: "")

    var meetingType: String?
        get() = getString("meetingType")
        set(value) = put("meetingType", value ?: "")

    var day: Int
        get() = getInt("day")
        set(value) = put("day", value)

    var time: String?
        get() = getString("time")
        set(value) = put("time", value ?: "")

    var city: String?
        get() = getString("city")
        set(value) = put("city", value ?: "")

    var state: String?
        get() = getString("state")
        set(value) = put("state", value ?: "")

    var address: String?
        get() = getString("address")
        set(value) = put("address", value ?: "")

    var locationName: String?
        get() = getString("locationName")
        set(value) = put("locationName", value ?: "")

    var isOnline: Boolean
        get() = getBoolean("isOnline")
        set(value) = put("isOnline", value)

    var onlineUrl: String?
        get() = getString("onlineUrl")
        set(value) = put("onlineUrl", value ?: "")

    var latitude: Double
        get() = getDouble("latitude")
        set(value) = put("latitude", value)

    var longitude: Double
        get() = getDouble("longitude")
        set(value) = put("longitude", value)
}
```

### Step 4: Display Meetings (Jetpack Compose)

```kotlin
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.parse.ParseQuery
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun MeetingsScreen() {
    var meetings by remember { mutableStateOf<List<Meeting>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            val query = ParseQuery.getQuery(Meeting::class.java)
                .setLimit(100)
                .orderByAscending("day")
                .addAscendingOrder("time")
            meetings = query.find()
            isLoading = false
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Meetings") })

        if (isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn {
                items(meetings) { meeting ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = meeting.name ?: "Meeting",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = "${meeting.city ?: ""}, ${meeting.state ?: ""}",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            }
        }
    }
}
```

### Common Android Queries

```kotlin
// Filter by state
val query = ParseQuery.getQuery(Meeting::class.java)
    .whereEqualTo("state", "CA")
val caMeetings = query.find()

// Filter by day (0=Sunday)
val mondayQuery = ParseQuery.getQuery(Meeting::class.java)
    .whereEqualTo("day", 1)

// AA meetings only
val aaQuery = ParseQuery.getQuery(Meeting::class.java)
    .whereEqualTo("meetingType", "AA")

// Online meetings
val onlineQuery = ParseQuery.getQuery(Meeting::class.java)
    .whereEqualTo("isOnline", true)

// Search by name (case-insensitive)
val searchQuery = ParseQuery.getQuery(Meeting::class.java)
    .whereMatches("name", "Serenity", "i")
```

---

## Meeting Data Reference

### Day of Week Values
| Value | Day |
|-------|-----|
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

### Meeting Types
- `AA` - Alcoholics Anonymous
- `NA` - Narcotics Anonymous
- `Al-Anon` - Al-Anon Family Groups
- `Alateen` - Alateen
- `CA` - Cocaine Anonymous
- `OA` - Overeaters Anonymous
- `GA` - Gamblers Anonymous

### Type Codes (in `types` array)
| Code | Meaning |
|------|---------|
| O | Open |
| C | Closed |
| D | Discussion |
| SP | Speaker |
| BB | Big Book |
| ST | Step Study |
| B | Beginners |
| W | Women |
| M | Men |
| Y | Young People |
| ONL | Online |
| HY | Hybrid |

---

## Advanced: Production-Ready ViewModels

For production apps, we provide full-featured ViewModels with:
- Flexible query building with fluent API
- Pagination with "Load More"
- Caching for performance
- Location-based queries
- Multiple filter combinations
- Loading states and error handling

### iOS ViewModel

Download the complete ViewModel: [`ios/MeetingViewModel.swift`](ios/MeetingViewModel.swift)

```swift
// Quick examples with the ViewModel:

let viewModel = MeetingViewModel()

// Load today's meetings
await viewModel.loadTodaysMeetings()

// Load nearby meetings
await viewModel.loadNearbyMeetings(location: userLocation)

// Search
await viewModel.search("Serenity")

// Fluent query builder - chain multiple filters
await viewModel.query()
    .states("CA", "AZ")
    .days(1, 3, 5)           // Mon, Wed, Fri
    .meetingTypes("AA")
    .typeCodes("O", "W")     // Open, Women
    .limit(100)
    .execute()

// Find online NA meetings
await viewModel.query()
    .meetingTypes("NA")
    .onlineOnly()
    .execute()
```

### Android ViewModel

Download the complete ViewModel: [`android/MeetingViewModel.kt`](android/MeetingViewModel.kt)

```kotlin
// Quick examples with the ViewModel:

val viewModel: MeetingViewModel by viewModels()

// Load today's meetings
viewModel.loadTodaysMeetings()

// Load nearby meetings
viewModel.loadNearbyMeetings(userLocation)

// Search
viewModel.search("Serenity")

// Fluent query builder - chain multiple filters
viewModel.query()
    .states("CA", "AZ")
    .days(1, 3, 5)           // Mon, Wed, Fri
    .meetingTypes("AA")
    .typeCodes("O", "W")     // Open, Women
    .limit(100)
    .execute()

// Observe state with Compose
val uiState by viewModel.uiState.collectAsState()
```

### ViewModel Features

| Feature | Description |
|---------|-------------|
| **Quick Methods** | `loadMeetings()`, `loadTodaysMeetings()`, `loadNearbyMeetings()`, `search()` |
| **Filters** | `filterByStates()`, `filterByDays()`, `filterByMeetingTypes()`, `filterByTypeCodes()` |
| **Query Builder** | Fluent API: `.states().days().meetingTypes().onlineOnly().execute()` |
| **Pagination** | `loadMore()` with automatic state tracking |
| **Caching** | 5-minute cache to reduce API calls |
| **Location** | `near(location, radiusMiles)` for proximity searches |

---

## Next Steps

- See [iOS Guide](https://docs.parseplatform.org/ios/guide/) for advanced ParseSwift usage
- See [Android Guide](https://docs.parseplatform.org/android/guide/) for advanced Parse Android usage
- Check the main [README.md](../README.md) for full API documentation
- View the in-app documentation for complete field schemas and query examples

## Troubleshooting

**Meetings not loading?**
- Verify your Application ID and Client Key are correct
- Check that meetings exist in your Back4app database
- Ensure your app has internet permission (Android)

**Empty results?**
- The Meeting class name is case-sensitive: `Meeting` not `meeting`
- Check query filters aren't too restrictive

**Parse initialization errors?**
- Server URL must end with `/` for Android: `https://parseapi.back4app.com/`
- Server URL should NOT end with `/` for iOS: `https://parseapi.back4app.com`
