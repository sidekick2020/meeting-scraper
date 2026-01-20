package com.sobersidekick.meetings

import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.parse.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

// MARK: - Meeting Model
@ParseClassName("Meeting")
class Meeting : ParseObject() {
    // Core fields
    var name: String?
        get() = getString("name")
        set(value) = value?.let { put("name", it) } ?: Unit

    var meetingType: String?
        get() = getString("meetingType")
        set(value) = value?.let { put("meetingType", it) } ?: Unit

    var day: Int
        get() = getInt("day")
        set(value) = put("day", value)

    var time: String?
        get() = getString("time")
        set(value) = value?.let { put("time", it) } ?: Unit

    var endTime: String?
        get() = getString("endTime")
        set(value) = value?.let { put("endTime", it) } ?: Unit

    // Location
    var address: String?
        get() = getString("address")
        set(value) = value?.let { put("address", it) } ?: Unit

    var city: String?
        get() = getString("city")
        set(value) = value?.let { put("city", it) } ?: Unit

    var state: String?
        get() = getString("state")
        set(value) = value?.let { put("state", it) } ?: Unit

    var postalCode: String?
        get() = getString("postalCode")
        set(value) = value?.let { put("postalCode", it) } ?: Unit

    var locationName: String?
        get() = getString("locationName")
        set(value) = value?.let { put("locationName", it) } ?: Unit

    var latitude: Double
        get() = getDouble("latitude")
        set(value) = put("latitude", value)

    var longitude: Double
        get() = getDouble("longitude")
        set(value) = put("longitude", value)

    // Online meeting info
    var isOnline: Boolean
        get() = getBoolean("isOnline")
        set(value) = put("isOnline", value)

    var isHybrid: Boolean
        get() = getBoolean("isHybrid")
        set(value) = put("isHybrid", value)

    var onlineUrl: String?
        get() = getString("onlineUrl")
        set(value) = value?.let { put("onlineUrl", it) } ?: Unit

    // Additional info
    var types: List<String>?
        get() = getList("types")
        set(value) = value?.let { put("types", it) } ?: Unit

    var notes: String?
        get() = getString("notes")
        set(value) = value?.let { put("notes", it) } ?: Unit

    var region: String?
        get() = getString("region")
        set(value) = value?.let { put("region", it) } ?: Unit

    // Computed properties
    val dayName: String
        get() {
            val days = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
            return if (day in 0..6) days[day] else "Unknown"
        }

    val formattedTime: String
        get() {
            val t = time ?: return ""
            return try {
                val inputFormat = SimpleDateFormat("HH:mm", Locale.US)
                val outputFormat = SimpleDateFormat("h:mm a", Locale.US)
                val date = inputFormat.parse(t)
                date?.let { outputFormat.format(it) } ?: t
            } catch (e: Exception) {
                t
            }
        }

    val hasCoordinates: Boolean
        get() = latitude != 0.0 && longitude != 0.0
}

// MARK: - Query Options
data class MeetingQueryOptions(
    var states: List<String> = emptyList(),           // Filter by states ["CA", "NY"]
    var days: List<Int> = emptyList(),                // Filter by days [0, 1, 6] (Sun, Mon, Sat)
    var meetingTypes: List<String> = emptyList(),     // Filter by type ["AA", "NA"]
    var typeCodes: List<String> = emptyList(),        // Filter by codes ["O", "W", "B"]
    var cities: List<String> = emptyList(),           // Filter by cities
    var searchText: String = "",                      // Search in name
    var onlineOnly: Boolean = false,                  // Only online meetings
    var inPersonOnly: Boolean = false,                // Only in-person meetings
    var hybridOnly: Boolean = false,                  // Only hybrid meetings

    // Location-based
    var nearLocation: ParseGeoPoint? = null,
    var radiusMiles: Double = 25.0,

    // Pagination
    var limit: Int = 50,
    var skip: Int = 0,

    // Sorting
    var sortBy: SortOption = SortOption.DAY_AND_TIME
) {
    enum class SortOption {
        DAY_AND_TIME,
        NAME,
        DISTANCE,
        CITY
    }

    val isEmpty: Boolean
        get() = states.isEmpty() && days.isEmpty() && meetingTypes.isEmpty() &&
                typeCodes.isEmpty() && cities.isEmpty() && searchText.isEmpty() &&
                !onlineOnly && !inPersonOnly && !hybridOnly && nearLocation == null
}

// MARK: - UI State
data class MeetingUiState(
    val meetings: List<Meeting> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val hasMoreResults: Boolean = true,
    val totalLoaded: Int = 0
)

// MARK: - ViewModel
class MeetingViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(MeetingUiState())
    val uiState: StateFlow<MeetingUiState> = _uiState.asStateFlow()

    private var queryOptions = MeetingQueryOptions()

    // Cache
    private val cache = mutableMapOf<String, List<Meeting>>()
    private val cacheTimestamps = mutableMapOf<String, Long>()
    private val cacheExpiration = 5 * 60 * 1000L // 5 minutes

    // MARK: - Quick Access Methods

    /** Load all meetings (paginated) */
    fun loadMeetings() {
        executeQuery()
    }

    /** Load meetings for today */
    fun loadTodaysMeetings() {
        val today = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1 // Convert to 0-indexed
        queryOptions = queryOptions.copy(days = listOf(today))
        executeQuery()
    }

    /** Load meetings near user's location */
    fun loadNearbyMeetings(latitude: Double, longitude: Double, radiusMiles: Double = 25.0) {
        val geoPoint = ParseGeoPoint(latitude, longitude)
        queryOptions = queryOptions.copy(
            nearLocation = geoPoint,
            radiusMiles = radiusMiles,
            sortBy = MeetingQueryOptions.SortOption.DISTANCE
        )
        executeQuery()
    }

    /** Load meetings near Android Location */
    fun loadNearbyMeetings(location: Location, radiusMiles: Double = 25.0) {
        loadNearbyMeetings(location.latitude, location.longitude, radiusMiles)
    }

    /** Quick search by name */
    fun search(text: String) {
        queryOptions = queryOptions.copy(searchText = text, skip = 0)
        _uiState.value = _uiState.value.copy(meetings = emptyList())
        executeQuery()
    }

    /** Load more results (pagination) */
    fun loadMore() {
        val state = _uiState.value
        if (!state.hasMoreResults || state.isLoading) return
        queryOptions = queryOptions.copy(skip = state.totalLoaded)
        executeQuery(append = true)
    }

    /** Reset and reload */
    fun refresh() {
        queryOptions = queryOptions.copy(skip = 0)
        _uiState.value = _uiState.value.copy(
            meetings = emptyList(),
            totalLoaded = 0,
            hasMoreResults = true
        )
        executeQuery()
    }

    // MARK: - Filter Methods

    /** Filter by state(s) */
    fun filterByStates(vararg states: String) {
        queryOptions = queryOptions.copy(states = states.toList())
        refresh()
    }

    /** Filter by day(s) of week */
    fun filterByDays(vararg days: Int) {
        queryOptions = queryOptions.copy(days = days.toList())
        refresh()
    }

    /** Filter by meeting type (AA, NA, etc.) */
    fun filterByMeetingTypes(vararg types: String) {
        queryOptions = queryOptions.copy(meetingTypes = types.toList())
        refresh()
    }

    /** Filter by type codes (Open, Women, Beginners, etc.) */
    fun filterByTypeCodes(vararg codes: String) {
        queryOptions = queryOptions.copy(typeCodes = codes.toList())
        refresh()
    }

    /** Filter online/in-person/hybrid */
    fun filterByAttendance(online: Boolean = false, inPerson: Boolean = false, hybrid: Boolean = false) {
        queryOptions = queryOptions.copy(
            onlineOnly = online,
            inPersonOnly = inPerson,
            hybridOnly = hybrid
        )
        refresh()
    }

    /** Clear all filters */
    fun clearFilters() {
        queryOptions = MeetingQueryOptions()
        refresh()
    }

    // MARK: - Advanced Query Builder

    /** Build and execute a custom query */
    fun query(): MeetingQueryBuilder {
        return MeetingQueryBuilder(this)
    }

    // MARK: - Internal Methods

    internal fun applyOptions(options: MeetingQueryOptions) {
        queryOptions = options
        refresh()
    }

    private fun executeQuery(append: Boolean = false) {
        val cacheKey = generateCacheKey()

        // Check cache first
        if (!append) {
            getCachedResults(cacheKey)?.let { cached ->
                _uiState.value = _uiState.value.copy(
                    meetings = cached,
                    totalLoaded = cached.size,
                    isLoading = false
                )
                return
            }
        }

        _uiState.value = _uiState.value.copy(isLoading = true, error = null)

        viewModelScope.launch {
            try {
                val results = withContext(Dispatchers.IO) {
                    val query = buildQuery()
                    query.find()
                }

                val currentMeetings = if (append) _uiState.value.meetings + results else results

                if (!append) {
                    cacheResults(results, cacheKey)
                }

                _uiState.value = _uiState.value.copy(
                    meetings = currentMeetings,
                    totalLoaded = currentMeetings.size,
                    hasMoreResults = results.size == queryOptions.limit,
                    isLoading = false,
                    error = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Unknown error"
                )
            }
        }
    }

    private fun buildQuery(): ParseQuery<Meeting> {
        val query = ParseQuery.getQuery(Meeting::class.java)

        // State filter
        if (queryOptions.states.isNotEmpty()) {
            query.whereContainedIn("state", queryOptions.states)
        }

        // Day filter
        if (queryOptions.days.isNotEmpty()) {
            query.whereContainedIn("day", queryOptions.days)
        }

        // Meeting type filter
        if (queryOptions.meetingTypes.isNotEmpty()) {
            query.whereContainedIn("meetingType", queryOptions.meetingTypes)
        }

        // Type codes filter
        if (queryOptions.typeCodes.isNotEmpty()) {
            query.whereContainsAll("types", queryOptions.typeCodes)
        }

        // City filter
        if (queryOptions.cities.isNotEmpty()) {
            query.whereContainedIn("city", queryOptions.cities)
        }

        // Search text
        if (queryOptions.searchText.isNotEmpty()) {
            query.whereMatches("name", queryOptions.searchText, "i")
        }

        // Online/In-person/Hybrid filters
        when {
            queryOptions.onlineOnly -> query.whereEqualTo("isOnline", true)
            queryOptions.inPersonOnly -> {
                query.whereEqualTo("isOnline", false)
                query.whereNotEqualTo("isHybrid", true)
            }
            queryOptions.hybridOnly -> query.whereEqualTo("isHybrid", true)
        }

        // Location-based filter
        queryOptions.nearLocation?.let { geoPoint ->
            query.whereWithinMiles("location", geoPoint, queryOptions.radiusMiles)
        }

        // Sorting
        when (queryOptions.sortBy) {
            MeetingQueryOptions.SortOption.DAY_AND_TIME -> {
                query.orderByAscending("day")
                query.addAscendingOrder("time")
            }
            MeetingQueryOptions.SortOption.NAME -> query.orderByAscending("name")
            MeetingQueryOptions.SortOption.CITY -> {
                query.orderByAscending("city")
                query.addAscendingOrder("name")
            }
            MeetingQueryOptions.SortOption.DISTANCE -> {
                // Distance sorting handled by geopoint query
            }
        }

        // Pagination
        query.limit = queryOptions.limit
        query.skip = queryOptions.skip

        return query
    }

    private fun generateCacheKey(): String {
        return "${queryOptions.states}-${queryOptions.days}-${queryOptions.meetingTypes}-${queryOptions.searchText}-${queryOptions.skip}"
    }

    private fun getCachedResults(key: String): List<Meeting>? {
        val timestamp = cacheTimestamps[key] ?: return null
        if (System.currentTimeMillis() - timestamp > cacheExpiration) {
            cache.remove(key)
            cacheTimestamps.remove(key)
            return null
        }
        return cache[key]
    }

    private fun cacheResults(results: List<Meeting>, key: String) {
        cache[key] = results
        cacheTimestamps[key] = System.currentTimeMillis()
    }

    fun clearCache() {
        cache.clear()
        cacheTimestamps.clear()
    }
}

// MARK: - Query Builder (Fluent API)
class MeetingQueryBuilder(private val viewModel: MeetingViewModel) {
    private var options = MeetingQueryOptions()

    /** Filter by state(s) */
    fun states(vararg states: String): MeetingQueryBuilder {
        options = options.copy(states = states.toList())
        return this
    }

    /** Filter by day(s) - 0=Sunday, 6=Saturday */
    fun days(vararg days: Int): MeetingQueryBuilder {
        options = options.copy(days = days.toList())
        return this
    }

    /** Filter by meeting type */
    fun meetingTypes(vararg types: String): MeetingQueryBuilder {
        options = options.copy(meetingTypes = types.toList())
        return this
    }

    /** Filter by type codes (O=Open, W=Women, B=Beginners, etc.) */
    fun typeCodes(vararg codes: String): MeetingQueryBuilder {
        options = options.copy(typeCodes = codes.toList())
        return this
    }

    /** Filter by cities */
    fun cities(vararg cities: String): MeetingQueryBuilder {
        options = options.copy(cities = cities.toList())
        return this
    }

    /** Search by name */
    fun search(text: String): MeetingQueryBuilder {
        options = options.copy(searchText = text)
        return this
    }

    /** Only online meetings */
    fun onlineOnly(): MeetingQueryBuilder {
        options = options.copy(onlineOnly = true)
        return this
    }

    /** Only in-person meetings */
    fun inPersonOnly(): MeetingQueryBuilder {
        options = options.copy(inPersonOnly = true)
        return this
    }

    /** Only hybrid meetings */
    fun hybridOnly(): MeetingQueryBuilder {
        options = options.copy(hybridOnly = true)
        return this
    }

    /** Near location */
    fun near(latitude: Double, longitude: Double, radiusMiles: Double = 25.0): MeetingQueryBuilder {
        options = options.copy(
            nearLocation = ParseGeoPoint(latitude, longitude),
            radiusMiles = radiusMiles
        )
        return this
    }

    /** Near Android Location */
    fun near(location: Location, radiusMiles: Double = 25.0): MeetingQueryBuilder {
        return near(location.latitude, location.longitude, radiusMiles)
    }

    /** Set result limit */
    fun limit(limit: Int): MeetingQueryBuilder {
        options = options.copy(limit = limit)
        return this
    }

    /** Sort by option */
    fun sortBy(sort: MeetingQueryOptions.SortOption): MeetingQueryBuilder {
        options = options.copy(sortBy = sort)
        return this
    }

    /** Execute the query */
    fun execute() {
        viewModel.applyOptions(options)
    }
}

/*
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 *
 * // QUICK USAGE:
 *
 * val viewModel: MeetingViewModel by viewModels()
 *
 * // Load all meetings
 * viewModel.loadMeetings()
 *
 * // Load today's meetings
 * viewModel.loadTodaysMeetings()
 *
 * // Search
 * viewModel.search("Serenity")
 *
 * // Load nearby
 * viewModel.loadNearbyMeetings(33.4484, -112.0740)
 * // or with Android Location:
 * viewModel.loadNearbyMeetings(location)
 *
 *
 * // FILTER USAGE:
 *
 * // Filter by state
 * viewModel.filterByStates("CA", "AZ")
 *
 * // Filter by day (Monday and Wednesday)
 * viewModel.filterByDays(1, 3)
 *
 * // Filter by meeting type
 * viewModel.filterByMeetingTypes("AA", "NA")
 *
 * // Online only
 * viewModel.filterByAttendance(online = true)
 *
 *
 * // FLUENT QUERY BUILDER:
 *
 * // Complex query with chaining
 * viewModel.query()
 *     .states("CA", "AZ")
 *     .days(1, 3, 5)           // Mon, Wed, Fri
 *     .meetingTypes("AA")
 *     .typeCodes("O", "D")     // Open, Discussion
 *     .search("Morning")
 *     .limit(100)
 *     .sortBy(MeetingQueryOptions.SortOption.DAY_AND_TIME)
 *     .execute()
 *
 * // Find women's meetings in California
 * viewModel.query()
 *     .states("CA")
 *     .typeCodes("W")
 *     .execute()
 *
 * // Find online NA meetings
 * viewModel.query()
 *     .meetingTypes("NA")
 *     .onlineOnly()
 *     .execute()
 *
 * // Find nearby beginner meetings
 * viewModel.query()
 *     .near(userLocation)
 *     .typeCodes("B")
 *     .execute()
 *
 *
 * // JETPACK COMPOSE UI EXAMPLE:
 *
 * @Composable
 * fun MeetingListScreen(viewModel: MeetingViewModel = viewModel()) {
 *     val uiState by viewModel.uiState.collectAsState()
 *
 *     LaunchedEffect(Unit) {
 *         viewModel.loadTodaysMeetings()
 *     }
 *
 *     Column(modifier = Modifier.fillMaxSize()) {
 *         TopAppBar(title = { Text("Meetings") })
 *
 *         when {
 *             uiState.isLoading && uiState.meetings.isEmpty() -> {
 *                 Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
 *                     CircularProgressIndicator()
 *                 }
 *             }
 *             uiState.error != null -> {
 *                 Text("Error: ${uiState.error}", color = Color.Red)
 *             }
 *             else -> {
 *                 LazyColumn {
 *                     items(uiState.meetings) { meeting ->
 *                         MeetingRow(meeting)
 *                     }
 *
 *                     if (uiState.hasMoreResults) {
 *                         item {
 *                             Button(
 *                                 onClick = { viewModel.loadMore() },
 *                                 modifier = Modifier.fillMaxWidth()
 *                             ) {
 *                                 Text("Load More")
 *                             }
 *                         }
 *                     }
 *                 }
 *             }
 *         }
 *     }
 * }
 *
 * @Composable
 * fun MeetingRow(meeting: Meeting) {
 *     Card(
 *         modifier = Modifier
 *             .fillMaxWidth()
 *             .padding(8.dp)
 *     ) {
 *         Column(modifier = Modifier.padding(16.dp)) {
 *             Text(
 *                 text = meeting.name ?: "Meeting",
 *                 style = MaterialTheme.typography.titleMedium
 *             )
 *             Text(
 *                 text = "${meeting.dayName} at ${meeting.formattedTime}",
 *                 style = MaterialTheme.typography.bodyMedium
 *             )
 *             Text(
 *                 text = "${meeting.city ?: ""}, ${meeting.state ?: ""}",
 *                 style = MaterialTheme.typography.bodySmall,
 *                 color = Color.Gray
 *             )
 *         }
 *     }
 * }
 *
 */
