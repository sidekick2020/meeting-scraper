import Foundation
import ParseSwift
import CoreLocation
import Combine

// MARK: - Meeting Model
struct Meeting: ParseObject {
    // Map to the "Meetings" class in Back4App (plural)
    static var className: String { "Meetings" }

    var objectId: String?
    var createdAt: Date?
    var updatedAt: Date?
    var ACL: ParseACL?
    var originalData: Data?

    // Core fields
    var name: String?
    var meetingType: String?       // AA, NA, Al-Anon, etc.
    var day: Int?                  // 0=Sunday, 6=Saturday
    var time: String?              // "19:00" format
    var endTime: String?

    // Location
    var address: String?
    var city: String?
    var state: String?
    var postalCode: String?
    var locationName: String?
    var latitude: Double?
    var longitude: Double?

    // Online meeting info
    var isOnline: Bool?
    var isHybrid: Bool?
    var onlineUrl: String?

    // Additional info
    var types: [String]?           // ["O", "D", "W"] - Open, Discussion, Women
    var notes: String?
    var region: String?

    // Computed properties
    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var dayName: String {
        let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        guard let day = day, day >= 0 && day < 7 else { return "Unknown" }
        return days[day]
    }

    var formattedTime: String {
        guard let time = time else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        if let date = formatter.date(from: time) {
            formatter.dateFormat = "h:mm a"
            return formatter.string(from: date)
        }
        return time
    }
}

// MARK: - Query Options
struct MeetingQueryOptions {
    var states: [String] = []              // Filter by states ["CA", "NY"]
    var days: [Int] = []                   // Filter by days [0, 1, 6] (Sun, Mon, Sat)
    var meetingTypes: [String] = []        // Filter by type ["AA", "NA"]
    var typeCodes: [String] = []           // Filter by codes ["O", "W", "B"]
    var cities: [String] = []              // Filter by cities
    var searchText: String = ""            // Search in name
    var onlineOnly: Bool = false           // Only online meetings
    var inPersonOnly: Bool = false         // Only in-person meetings
    var hybridOnly: Bool = false           // Only hybrid meetings

    // Location-based
    var nearLocation: CLLocationCoordinate2D? = nil
    var radiusMiles: Double = 25

    // Pagination
    var limit: Int = 50
    var skip: Int = 0

    // Sorting
    var sortBy: SortOption = .dayAndTime

    enum SortOption {
        case dayAndTime
        case name
        case distance
        case city
    }

    var isEmpty: Bool {
        states.isEmpty && days.isEmpty && meetingTypes.isEmpty &&
        typeCodes.isEmpty && cities.isEmpty && searchText.isEmpty &&
        !onlineOnly && !inPersonOnly && !hybridOnly && nearLocation == nil
    }
}

// MARK: - ViewModel
@MainActor
class MeetingViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var meetings: [Meeting] = []
    @Published var isLoading = false
    @Published var error: Error?
    @Published var hasMoreResults = true
    @Published var totalLoaded = 0

    // Query state
    @Published var queryOptions = MeetingQueryOptions()

    // Cache
    private var cache: [String: [Meeting]] = [:]
    private let cacheExpiration: TimeInterval = 300 // 5 minutes
    private var cacheTimestamps: [String: Date] = [:]

    // MARK: - Quick Access Methods

    /// Load all meetings (paginated)
    func loadMeetings() async {
        await executeQuery()
    }

    /// Load meetings for today
    func loadTodaysMeetings() async {
        let today = Calendar.current.component(.weekday, from: Date()) - 1 // Convert to 0-indexed
        queryOptions.days = [today]
        await executeQuery()
    }

    /// Load meetings near user's location
    func loadNearbyMeetings(location: CLLocationCoordinate2D, radiusMiles: Double = 25) async {
        queryOptions.nearLocation = location
        queryOptions.radiusMiles = radiusMiles
        queryOptions.sortBy = .distance
        await executeQuery()
    }

    /// Quick search by name
    func search(_ text: String) async {
        queryOptions.searchText = text
        queryOptions.skip = 0
        meetings = []
        await executeQuery()
    }

    /// Load more results (pagination)
    func loadMore() async {
        guard hasMoreResults && !isLoading else { return }
        queryOptions.skip = totalLoaded
        await executeQuery(append: true)
    }

    /// Reset and reload
    func refresh() async {
        queryOptions.skip = 0
        meetings = []
        totalLoaded = 0
        hasMoreResults = true
        await executeQuery()
    }

    // MARK: - Filter Methods

    /// Filter by state(s)
    func filterByStates(_ states: [String]) async {
        queryOptions.states = states
        await refresh()
    }

    /// Filter by day(s) of week
    func filterByDays(_ days: [Int]) async {
        queryOptions.days = days
        await refresh()
    }

    /// Filter by meeting type (AA, NA, etc.)
    func filterByMeetingTypes(_ types: [String]) async {
        queryOptions.meetingTypes = types
        await refresh()
    }

    /// Filter by type codes (Open, Women, Beginners, etc.)
    func filterByTypeCodes(_ codes: [String]) async {
        queryOptions.typeCodes = codes
        await refresh()
    }

    /// Filter online/in-person/hybrid
    func filterByAttendance(online: Bool = false, inPerson: Bool = false, hybrid: Bool = false) async {
        queryOptions.onlineOnly = online
        queryOptions.inPersonOnly = inPerson
        queryOptions.hybridOnly = hybrid
        await refresh()
    }

    /// Clear all filters
    func clearFilters() async {
        queryOptions = MeetingQueryOptions()
        await refresh()
    }

    // MARK: - Advanced Query Builder

    /// Build and execute a custom query
    func query() -> MeetingQueryBuilder {
        return MeetingQueryBuilder(viewModel: self)
    }

    // MARK: - Private Methods

    private func executeQuery(append: Bool = false) async {
        let cacheKey = generateCacheKey()

        // Check cache first
        if let cached = getCachedResults(for: cacheKey), !append {
            self.meetings = cached
            self.totalLoaded = cached.count
            return
        }

        isLoading = true
        error = nil

        do {
            var query = Meeting.query()

            // Apply filters
            query = applyFilters(to: query)

            // Apply sorting
            query = applySorting(to: query)

            // Apply pagination
            query = query.limit(queryOptions.limit).skip(queryOptions.skip)

            let results = try await query.find()

            if append {
                meetings.append(contentsOf: results)
            } else {
                meetings = results
                cacheResults(results, for: cacheKey)
            }

            totalLoaded = meetings.count
            hasMoreResults = results.count == queryOptions.limit

        } catch {
            self.error = error
            print("Query error: \(error)")
        }

        isLoading = false
    }

    private func applyFilters(to query: Query<Meeting>) -> Query<Meeting> {
        var q = query

        // State filter
        if !queryOptions.states.isEmpty {
            q = q.containedIn("state", array: queryOptions.states)
        }

        // Day filter
        if !queryOptions.days.isEmpty {
            q = q.containedIn("day", array: queryOptions.days)
        }

        // Meeting type filter
        if !queryOptions.meetingTypes.isEmpty {
            q = q.containedIn("meetingType", array: queryOptions.meetingTypes)
        }

        // Type codes filter (contained in array)
        if !queryOptions.typeCodes.isEmpty {
            q = q.containsAll("types", array: queryOptions.typeCodes)
        }

        // City filter
        if !queryOptions.cities.isEmpty {
            q = q.containedIn("city", array: queryOptions.cities)
        }

        // Search text
        if !queryOptions.searchText.isEmpty {
            q = q.regex("name", regex: queryOptions.searchText, modifiers: "i")
        }

        // Online/In-person/Hybrid filters
        if queryOptions.onlineOnly {
            q = q.where("isOnline" == true)
        }
        if queryOptions.inPersonOnly {
            q = q.where("isOnline" == false).where("isHybrid" != true)
        }
        if queryOptions.hybridOnly {
            q = q.where("isHybrid" == true)
        }

        // Location-based filter
        if let location = queryOptions.nearLocation {
            let geoPoint = try? ParseGeoPoint(latitude: location.latitude, longitude: location.longitude)
            if let point = geoPoint {
                q = q.withinMiles("location", geoPoint: point, distance: queryOptions.radiusMiles)
            }
        }

        return q
    }

    private func applySorting(to query: Query<Meeting>) -> Query<Meeting> {
        switch queryOptions.sortBy {
        case .dayAndTime:
            return query.order([.ascending("day"), .ascending("time")])
        case .name:
            return query.order([.ascending("name")])
        case .city:
            return query.order([.ascending("city"), .ascending("name")])
        case .distance:
            // Distance sorting handled by geopoint query
            return query
        }
    }

    private func generateCacheKey() -> String {
        let key = "\(queryOptions.states)-\(queryOptions.days)-\(queryOptions.meetingTypes)-\(queryOptions.searchText)-\(queryOptions.skip)"
        return key
    }

    private func getCachedResults(for key: String) -> [Meeting]? {
        guard let timestamp = cacheTimestamps[key],
              Date().timeIntervalSince(timestamp) < cacheExpiration,
              let cached = cache[key] else {
            return nil
        }
        return cached
    }

    private func cacheResults(_ results: [Meeting], for key: String) {
        cache[key] = results
        cacheTimestamps[key] = Date()
    }

    func clearCache() {
        cache.removeAll()
        cacheTimestamps.removeAll()
    }
}

// MARK: - Query Builder (Fluent API)
@MainActor
class MeetingQueryBuilder {
    private weak var viewModel: MeetingViewModel?
    private var options = MeetingQueryOptions()

    init(viewModel: MeetingViewModel) {
        self.viewModel = viewModel
    }

    /// Filter by state(s)
    func states(_ states: String...) -> MeetingQueryBuilder {
        options.states = states
        return self
    }

    /// Filter by day(s) - 0=Sunday, 6=Saturday
    func days(_ days: Int...) -> MeetingQueryBuilder {
        options.days = days
        return self
    }

    /// Filter by meeting type
    func meetingTypes(_ types: String...) -> MeetingQueryBuilder {
        options.meetingTypes = types
        return self
    }

    /// Filter by type codes (O=Open, W=Women, B=Beginners, etc.)
    func typeCodes(_ codes: String...) -> MeetingQueryBuilder {
        options.typeCodes = codes
        return self
    }

    /// Filter by cities
    func cities(_ cities: String...) -> MeetingQueryBuilder {
        options.cities = cities
        return self
    }

    /// Search by name
    func search(_ text: String) -> MeetingQueryBuilder {
        options.searchText = text
        return self
    }

    /// Only online meetings
    func onlineOnly() -> MeetingQueryBuilder {
        options.onlineOnly = true
        return self
    }

    /// Only in-person meetings
    func inPersonOnly() -> MeetingQueryBuilder {
        options.inPersonOnly = true
        return self
    }

    /// Only hybrid meetings
    func hybridOnly() -> MeetingQueryBuilder {
        options.hybridOnly = true
        return self
    }

    /// Near location
    func near(_ location: CLLocationCoordinate2D, radiusMiles: Double = 25) -> MeetingQueryBuilder {
        options.nearLocation = location
        options.radiusMiles = radiusMiles
        return self
    }

    /// Set result limit
    func limit(_ limit: Int) -> MeetingQueryBuilder {
        options.limit = limit
        return self
    }

    /// Sort by option
    func sortBy(_ sort: MeetingQueryOptions.SortOption) -> MeetingQueryBuilder {
        options.sortBy = sort
        return self
    }

    /// Execute the query
    func execute() async {
        guard let vm = viewModel else { return }
        vm.queryOptions = options
        await vm.refresh()
    }
}

// MARK: - Usage Examples
/*

 // QUICK USAGE:

 let viewModel = MeetingViewModel()

 // Load all meetings
 await viewModel.loadMeetings()

 // Load today's meetings
 await viewModel.loadTodaysMeetings()

 // Search
 await viewModel.search("Serenity")

 // Load nearby
 let userLocation = CLLocationCoordinate2D(latitude: 33.4484, longitude: -112.0740)
 await viewModel.loadNearbyMeetings(location: userLocation)


 // FILTER USAGE:

 // Filter by state
 await viewModel.filterByStates(["CA", "AZ"])

 // Filter by day (Monday and Wednesday)
 await viewModel.filterByDays([1, 3])

 // Filter by meeting type
 await viewModel.filterByMeetingTypes(["AA", "NA"])

 // Online only
 await viewModel.filterByAttendance(online: true)


 // FLUENT QUERY BUILDER:

 // Complex query with chaining
 await viewModel.query()
     .states("CA", "AZ")
     .days(1, 3, 5)           // Mon, Wed, Fri
     .meetingTypes("AA")
     .typeCodes("O", "D")     // Open, Discussion
     .search("Morning")
     .limit(100)
     .sortBy(.dayAndTime)
     .execute()

 // Find women's meetings in California
 await viewModel.query()
     .states("CA")
     .typeCodes("W")
     .execute()

 // Find online NA meetings
 await viewModel.query()
     .meetingTypes("NA")
     .onlineOnly()
     .execute()

 // Find nearby beginner meetings
 await viewModel.query()
     .near(userLocation, radiusMiles: 10)
     .typeCodes("B")
     .execute()


 // SWIFTUI VIEW EXAMPLE:

 struct MeetingListView: View {
     @StateObject private var viewModel = MeetingViewModel()

     var body: some View {
         NavigationView {
             Group {
                 if viewModel.isLoading && viewModel.meetings.isEmpty {
                     ProgressView("Loading meetings...")
                 } else if let error = viewModel.error {
                     Text("Error: \(error.localizedDescription)")
                 } else {
                     List {
                         ForEach(viewModel.meetings, id: \.objectId) { meeting in
                             MeetingRow(meeting: meeting)
                         }

                         if viewModel.hasMoreResults {
                             Button("Load More") {
                                 Task { await viewModel.loadMore() }
                             }
                         }
                     }
                 }
             }
             .navigationTitle("Meetings")
             .task {
                 await viewModel.loadTodaysMeetings()
             }
             .refreshable {
                 await viewModel.refresh()
             }
         }
     }
 }

 */
