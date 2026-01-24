**iOS Parse Class Name Fix**: Fixed iOS Swift model to use correct "Meetings" class name
- ParseSwift was defaulting to "Meeting" (singular) instead of "Meetings" (plural)
- Added explicit `static var className` override to match Back4App table name
- Updated all Swift code examples in documentation and DevDocs component
