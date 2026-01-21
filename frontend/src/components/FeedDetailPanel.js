import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Source feed metadata - maps feed names to their details
// Note: The backend dynamically provides feed data, so this is supplementary metadata
// for enhanced display. Feeds not listed here will use backend-provided data.
const feedMetadata = {
  // === ALABAMA AA ===
  "Shoals AA (District 1)": { type: "AA", format: "TSML", state: "AL", region: "Shoals/Florence", url: "https://shoalsaa.org", description: "AA meetings in Florence, Moulton, Russellville & surrounding Colbert, Franklin, Lauderdale Counties." },
  "Birmingham AA": { type: "AA", format: "TSML", state: "AL", region: "Birmingham Metro", url: "https://birminghamaa.org", description: "Birmingham and surrounding area AA meetings in Alabama." },
  "Mobile AA (District 12)": { type: "AA", format: "TSML", state: "AL", region: "Mobile/Gulf Coast", url: "https://mobileaa.org", description: "Mobile, Chickasaw, Citronelle, Dauphin Island and surrounding counties." },
  "Huntsville AA (District 20)": { type: "AA", format: "TSML", state: "AL", region: "Huntsville/Madison", url: "https://aahuntsvilleal.com", description: "Athens, Decatur, Huntsville, Madison and Morgan City meetings." },

  // === ALASKA AA ===
  "Anchorage AA": { type: "AA", format: "TSML", state: "AK", region: "Anchorage", url: "https://anchorageaa.org", description: "Anchorage area AA meetings. Helpline: (907) 272-2312." },
  "Fairbanks AA": { type: "AA", format: "TSML", state: "AK", region: "Fairbanks", url: "https://fairbanksaa.org", description: "Fairbanks area AA meetings." },

  // === ARIZONA AA ===
  "Phoenix": { type: "AA", format: "TSML", state: "AZ", region: "Phoenix Metro", url: "https://aaphoenix.org", description: "Phoenix metro area AA meetings. Helpline: (602) 264-1341." },
  "Tucson AA": { type: "AA", format: "TSML", state: "AZ", region: "Tucson Metro", url: "https://aatucson.org", description: "Tucson area AA meetings. Helpline: (520) 624-4183." },
  "Flagstaff AA": { type: "AA", format: "TSML", state: "AZ", region: "Flagstaff", url: "https://flagstaffaa.org", description: "Flagstaff area AA meetings." },

  // === CALIFORNIA AA ===
  "Palo Alto (Bay Area)": { type: "AA", format: "TSML", state: "CA", region: "Bay Area", url: "https://sheets.code4recovery.org", description: "Covers AA meetings in the Palo Alto and greater Bay Area region." },
  "San Diego": { type: "AA", format: "TSML", state: "CA", region: "San Diego County", url: "https://aasandiego.org", description: "San Diego County AA meetings and groups." },
  "Los Angeles AA": { type: "AA", format: "TSML", state: "CA", region: "Los Angeles", url: "https://lacoaa.org", description: "Los Angeles Central Office AA meetings. Phone: (323) 936-4343." },
  "Orange County AA": { type: "AA", format: "TSML", state: "CA", region: "Orange County", url: "https://www.oc-aa.org", description: "Orange County AA meetings. Phone: 714-556-4555." },
  "Sacramento AA (CCFAA)": { type: "AA", format: "TSML", state: "CA", region: "Sacramento", url: "https://aasacramento.org", description: "Central California Fellowship of AA. 24-Hour Hotline: 916-454-1100." },
  "San Jose AA": { type: "AA", format: "TSML", state: "CA", region: "Santa Clara County", url: "https://aasanjose.org", description: "Santa Clara County / San Jose area AA meetings." },
  "East Bay AA (Oakland)": { type: "AA", format: "TSML", state: "CA", region: "East Bay", url: "https://eastbayaa.org", description: "East Bay AA meetings. Helpline: (510) 839-8900." },
  "Inland Empire AA": { type: "AA", format: "TSML", state: "CA", region: "Riverside/San Bernardino", url: "https://aainlandempire.org", description: "Serves Riverside & San Bernardino Counties." },

  // === COLORADO AA ===
  "Denver AA (DACCAA)": { type: "AA", format: "TSML", state: "CO", region: "Denver Metro", url: "https://daccaa.org", description: "Denver Area Central Committee of AA." },
  "Boulder AA": { type: "AA", format: "TSML", state: "CO", region: "Boulder County", url: "https://www.bouldercountyaa.com", description: "Boulder County AA meetings." },
  "Northern Colorado AA (Fort Collins)": { type: "AA", format: "TSML", state: "CO", region: "Northern Colorado", url: "https://nocoaa.org", description: "Fort Collins and Front Range area meetings." },

  // === CONNECTICUT AA ===
  "Connecticut AA": { type: "AA", format: "TSML", state: "CT", region: "Statewide", url: "https://ct-aa.org", description: "Statewide Connecticut AA meetings." },

  // === FLORIDA AA ===
  "Central Florida AA (Orlando)": { type: "AA", format: "TSML", state: "FL", region: "Orlando/Central FL", url: "https://cflintergroup.org", description: "Central Florida / Orlando area AA meetings." },
  "Palm Beach County AA": { type: "AA", format: "TSML", state: "FL", region: "Palm Beach", url: "https://aa-palmbeachcounty.org", description: "Palm Beach County AA meetings." },
  "Broward County AA": { type: "AA", format: "TSML", state: "FL", region: "Broward County", url: "https://aabroward.org", description: "Broward County AA meetings." },
  "Gainesville AA": { type: "AA", format: "TSML", state: "FL", region: "North Central FL", url: "https://aagainesville.org", description: "Gainesville and North Central Florida AA meetings." },

  // === GEORGIA AA ===
  "Atlanta AA": { type: "AA", format: "TSML", state: "GA", region: "Atlanta Metro", url: "https://atlantaaa.org", description: "Atlanta metro area AA meetings." },
  "Savannah AA": { type: "AA", format: "TSML", state: "GA", region: "Savannah/Coastal", url: "https://savannahaa.com", description: "Chatham, Bryan, Effingham Counties AA meetings." },

  // === HAWAII AA ===
  "Oahu AA": { type: "AA", format: "TSML", state: "HI", region: "Oahu", url: "https://oahuaa.org", description: "Oahu island AA meetings." },
  "Maui AA": { type: "AA", format: "TSML", state: "HI", region: "Maui", url: "https://aamaui.org", description: "Maui island AA meetings." },

  // === ILLINOIS AA ===
  "Central Illinois AA (District 11)": { type: "AA", format: "TSML", state: "IL", region: "Central Illinois", url: "https://aaci11.org", description: "Decatur, Clinton, Shelbyville, Taylorville area." },
  "Southern Illinois AA (Area 21)": { type: "AA", format: "TSML", state: "IL", region: "Southern Illinois", url: "https://area21aa.org", description: "Southern Illinois AA meetings." },

  // === INDIANA AA ===
  "Indianapolis AA": { type: "AA", format: "TSML", state: "IN", region: "Indianapolis", url: "https://indyaa.org", description: "Indianapolis area AA meetings." },
  "Fort Wayne AA": { type: "AA", format: "TSML", state: "IN", region: "Fort Wayne", url: "https://aafortwayne.org", description: "Fort Wayne / northeast Indiana AA meetings." },

  // === IOWA AA ===
  "Iowa AA (Area 24)": { type: "AA", format: "TSML", state: "IA", region: "Statewide", url: "https://aa-iowa.org", description: "Statewide Iowa AA meeting listings." },
  "Des Moines AA": { type: "AA", format: "TSML", state: "IA", region: "Des Moines", url: "https://aadesmoines.org", description: "Des Moines area AA meetings." },

  // === KANSAS AA ===
  "Kansas City AA": { type: "AA", format: "TSML", state: "KS", region: "Kansas City", url: "https://kc-aa.org", description: "Kansas City metro AA meetings." },
  "Topeka AA": { type: "AA", format: "TSML", state: "KS", region: "Topeka", url: "https://aatopeka.org", description: "Topeka and environs AA meetings." },

  // === KENTUCKY AA ===
  "Louisville AA": { type: "AA", format: "TSML", state: "KY", region: "Louisville", url: "https://loukyaa.org", description: "Louisville area AA meetings." },
  "Bluegrass AA (Lexington)": { type: "AA", format: "TSML", state: "KY", region: "Lexington/Bluegrass", url: "https://bluegrassintergroup.org", description: "Lexington / Bluegrass region AA meetings." },

  // === LOUISIANA AA ===
  "New Orleans AA": { type: "AA", format: "TSML", state: "LA", region: "New Orleans", url: "https://aaneworleans.org", description: "Greater New Orleans area AA meetings." },
  "Baton Rouge AA": { type: "AA", format: "TSML", state: "LA", region: "Baton Rouge", url: "https://aabatonrouge.org", description: "Baton Rouge area AA meetings." },

  // === MARYLAND AA ===
  "Baltimore AA": { type: "AA", format: "TSML", state: "MD", region: "Baltimore", url: "https://baltimoreaa.org", description: "Baltimore and surrounding counties AA meetings." },
  "Maryland AA (Area 29)": { type: "AA", format: "TSML", state: "MD", region: "Statewide", url: "https://marylandaa.org", description: "Statewide Maryland AA meetings." },

  // === MASSACHUSETTS AA ===
  "Boston AA": { type: "AA", format: "TSML", state: "MA", region: "Boston", url: "https://aaboston.org", description: "Boston Central Service Office AA meetings." },
  "Worcester AA": { type: "AA", format: "TSML", state: "MA", region: "Worcester", url: "https://aaworcester.org", description: "Worcester area AA meetings." },

  // === MICHIGAN AA ===
  "Southeastern Michigan AA (Area 33)": { type: "AA", format: "TSML", state: "MI", region: "SE Michigan", url: "https://aa-semi.org", description: "Wayne, Oakland, Macomb, St. Clair, Sanilac counties." },

  // === MINNESOTA AA ===
  "Minneapolis AA": { type: "AA", format: "TSML", state: "MN", region: "Minneapolis", url: "https://aaminneapolis.org", description: "Minneapolis & suburbs. 24-hour phone: (952) 922-0880." },
  "St. Paul AA": { type: "AA", format: "TSML", state: "MN", region: "St. Paul", url: "https://aastpaul.org", description: "St. Paul & Ramsey County area AA meetings." },

  // === NEW JERSEY AA ===
  "Northern New Jersey AA (Area 44)": { type: "AA", format: "TSML", state: "NJ", region: "Northern NJ", url: "https://nnjaa.org", description: "Bergen, Essex, Hudson, Morris, Passaic, Somerset, Sussex, Union, Warren counties." },
  "South Jersey AA": { type: "AA", format: "TSML", state: "NJ", region: "South Jersey", url: "https://aasj.org", description: "South Jersey AA meetings. Hotline: 856-486-4444." },

  // === NEW YORK AA ===
  "New York Intergroup (NYC)": { type: "AA", format: "TSML", state: "NY", region: "New York City", url: "https://nyintergroup.org", description: "New York City AA meetings." },
  "Brooklyn AA": { type: "AA", format: "TSML", state: "NY", region: "Brooklyn", url: "https://brooklynintergroup.org", description: "Brooklyn AA meetings." },
  "Central New York AA (Area 47)": { type: "AA", format: "TSML", state: "NY", region: "Central NY", url: "https://aacny.org", description: "Central New York AA meetings." },

  // === NORTH CAROLINA AA ===
  "Charlotte AA": { type: "AA", format: "TSML", state: "NC", region: "Charlotte", url: "https://charlotteaa.org", description: "Charlotte/Mecklenburg region AA meetings." },
  "Western NC AA (Mountain)": { type: "AA", format: "TSML", state: "NC", region: "Western NC", url: "https://aancmco.org", description: "Western NC mountain region. Hotline: (828) 254-8539." },

  // === OHIO AA ===
  "Central Ohio AA": { type: "AA", format: "TSML", state: "OH", region: "Central Ohio", url: "https://aacentralohio.org", description: "Central & Southeastern Ohio. Hotline: (614) 253-8501." },
  "Akron AA": { type: "AA", format: "TSML", state: "OH", region: "Akron", url: "https://akronaa.org", description: "Akron area AA meetings - birthplace of AA." },

  // === PENNSYLVANIA AA ===
  "Western Pennsylvania AA (Area 60)": { type: "AA", format: "TSML", state: "PA", region: "Western PA", url: "https://wpaarea60.org", description: "Western Pennsylvania AA meetings." },
  "Harrisburg AA": { type: "AA", format: "TSML", state: "PA", region: "Harrisburg", url: "https://aaharrisburg.org", description: "Central PA / Harrisburg region AA meetings." },

  // === TENNESSEE AA ===
  "Nashville AA": { type: "AA", format: "TSML", state: "TN", region: "Nashville", url: "https://aanashville.org", description: "Middle Tennessee AA meetings. Hotline: 615-831-1050." },
  "East Tennessee AA": { type: "AA", format: "TSML", state: "TN", region: "East Tennessee", url: "https://etiaa.org", description: "26 counties in East Tennessee." },

  // === TEXAS AA ===
  "Houston AA": { type: "AA", format: "TSML", state: "TX", region: "Houston", url: "https://aahouston.org", description: "Houston metro area AA meetings - ~2,500 meetings weekly." },
  "Dallas AA": { type: "AA", format: "TSML", state: "TX", region: "Dallas", url: "https://aadallas.org", description: "Dallas area AA meetings. 24/7 Hotline: 214-887-6699." },
  "Austin AA": { type: "AA", format: "TSML", state: "TX", region: "Austin", url: "https://www.austinaa.org", description: "Austin area AA meetings." },

  // === VIRGINIA AA ===
  "Northern Virginia AA": { type: "AA", format: "TSML", state: "VA", region: "Northern VA", url: "https://nvintergroup.org", description: "Northern Virginia AA. 24-Hour Hotline: 703-293-9753." },
  "Richmond AA": { type: "AA", format: "TSML", state: "VA", region: "Richmond", url: "https://www.aarichmond.org", description: "Richmond and central Virginia AA meetings." },
  "Blue Ridge AA": { type: "AA", format: "TSML", state: "VA", region: "Blue Ridge", url: "https://aablueridge.org", description: "Blue Ridge mountain region AA meetings." },

  // === WASHINGTON AA ===
  "Seattle AA (Greater Seattle)": { type: "AA", format: "TSML", state: "WA", region: "Seattle", url: "https://seattleaa.org", description: "Greater Seattle AA. 24-hr: 206-587-2838." },
  "Eastside AA (Seattle)": { type: "AA", format: "TSML", state: "WA", region: "Seattle Eastside", url: "https://www.eastsideaa.org", description: "Seattle Eastside AA meetings." },

  // === WISCONSIN AA ===
  "Madison WI AA": { type: "AA", format: "TSML", state: "WI", region: "Madison", url: "https://aamadisonwi.org", description: "South central Wisconsin AA meetings." },
  "Milwaukee AA": { type: "AA", format: "TSML", state: "WI", region: "Milwaukee", url: "https://aamilwaukee.com", description: "Greater Milwaukee area. Hotline: 414-771-9119." },

  // ========================================
  // NA FEEDS (BMLT format)
  // ========================================

  // === STATEWIDE/REGIONAL NA ===
  "Alabama NA": { type: "NA", format: "BMLT", state: "AL", region: "Alabama", url: "https://bmlt.sezf.org", description: "Narcotics Anonymous meetings across Alabama." },
  "Alaska NA": { type: "NA", format: "BMLT", state: "AK", region: "Alaska", url: "https://akna.org", description: "Narcotics Anonymous meetings across Alaska." },
  "Arizona NA": { type: "NA", format: "BMLT", state: "AZ", region: "Arizona", url: "https://arizona-na.org", description: "Statewide Arizona NA meetings." },
  "Arkansas NA": { type: "NA", format: "BMLT", state: "AR", region: "Arkansas", url: "https://arscna.org", description: "Arkansas Regional Service Committee of NA." },
  "Southern California NA": { type: "NA", format: "BMLT", state: "CA", region: "Southern California", url: "https://todayna.org", description: "Southern California Region of NA." },
  "Northern California NA": { type: "NA", format: "BMLT", state: "CA", region: "Northern California", url: "https://norcalna.org", description: "Northern California Region of NA." },
  "Connecticut NA": { type: "NA", format: "BMLT", state: "CT", region: "Connecticut", url: "https://ctna.org", description: "Connecticut Region of NA." },
  "Florida NA": { type: "NA", format: "BMLT", state: "FL", region: "Florida", url: "https://naflorida.org", description: "Florida Region NA - statewide meetings." },
  "South Florida NA": { type: "NA", format: "BMLT", state: "FL", region: "South Florida", url: "https://sfrna.net", description: "South Florida Region NA meetings." },
  "Georgia NA": { type: "NA", format: "BMLT", state: "GA", region: "Georgia", url: "https://grscna.com", description: "Georgia Regional Service Committee of NA." },
  "Hawaii NA": { type: "NA", format: "BMLT", state: "HI", region: "Hawaii", url: "https://na-hawaii.org", description: "Hawaii Regional Service Committee of NA." },
  "Chicagoland NA": { type: "NA", format: "BMLT", state: "IL", region: "Chicago", url: "https://chicagona.org", description: "Chicagoland Region of NA." },
  "Indiana NA": { type: "NA", format: "BMLT", state: "IN", region: "Indiana", url: "https://naindiana.org", description: "Indiana Region of NA." },
  "Iowa NA": { type: "NA", format: "BMLT", state: "IA", region: "Iowa", url: "https://iowa-na.org", description: "Iowa Region of NA." },
  "Louisville NA": { type: "NA", format: "BMLT", state: "KY", region: "Louisville", url: "https://nalouisville.net", description: "Louisville Area of NA." },
  "Louisiana NA": { type: "NA", format: "BMLT", state: "LA", region: "Louisiana", url: "https://larna.org", description: "Louisiana Region of NA." },
  "Maine NA": { type: "NA", format: "BMLT", state: "ME", region: "Maine", url: "https://namaine.org", description: "Maine Narcotics Anonymous." },
  "Michigan NA": { type: "NA", format: "BMLT", state: "MI", region: "Michigan", url: "https://michigan-na.org", description: "Michigan Region NA." },
  "Minnesota NA": { type: "NA", format: "BMLT", state: "MN", region: "Minnesota", url: "https://naminnesota.org", description: "Minnesota Regional NA. Helpline: 1-877-767-7676." },
  "Mississippi NA": { type: "NA", format: "BMLT", state: "MS", region: "Mississippi", url: "https://mrscna.net", description: "Mississippi Region of NA." },
  "Missouri NA": { type: "NA", format: "BMLT", state: "MO", region: "Missouri", url: "https://missourina.org", description: "Missouri NA - Show Me Region." },
  "Nebraska NA": { type: "NA", format: "BMLT", state: "NE", region: "Nebraska", url: "https://nebraskana.org", description: "Nebraska Region of NA. Helpline: 844-818-3733." },
  "New Jersey NA": { type: "NA", format: "BMLT", state: "NJ", region: "New Jersey", url: "https://nanj.org", description: "New Jersey NA. 24-Hour Helpline: 800-992-0401." },
  "Greater New York NA": { type: "NA", format: "BMLT", state: "NY", region: "New York", url: "https://newyorkna.org", description: "Greater New York Region of NA." },
  "NYC NA": { type: "NA", format: "BMLT", state: "NY", region: "New York City", url: "https://nycna.org", description: "NYC Area NA - Manhattan, Queens, Brooklyn, Bronx, Staten Island." },
  "North Carolina NA": { type: "NA", format: "BMLT", state: "NC", region: "North Carolina", url: "https://ncregion-na.org", description: "NC Region NA. Helpline: 1-855-227-NCNA." },
  "Ohio NA": { type: "NA", format: "BMLT", state: "OH", region: "Ohio", url: "https://naohio.org", description: "Ohio Regional Service Committee of NA." },
  "Oklahoma NA": { type: "NA", format: "BMLT", state: "OK", region: "Oklahoma", url: "https://okna.org", description: "OK Region of NA." },
  "Portland NA": { type: "NA", format: "BMLT", state: "OR", region: "Portland", url: "https://portlandna.com", description: "Portland Area NA meetings." },
  "Mid-Atlantic NA (PA)": { type: "NA", format: "BMLT", state: "PA", region: "Pennsylvania", url: "https://marscna.org", description: "Mid-Atlantic Region NA - Central PA." },
  "South Dakota NA": { type: "NA", format: "BMLT", state: "SD", region: "South Dakota", url: "https://sdrna.org", description: "South Dakota Region of NA. Helpline: 605-939-0502." },
  "Tennessee NA (Volunteer Region)": { type: "NA", format: "BMLT", state: "TN", region: "Tennessee", url: "https://natennessee.org", description: "Volunteer Region of NA. Helpline: 901-350-5030." },
  "Dallas NA": { type: "NA", format: "BMLT", state: "TX", region: "Dallas", url: "https://dallasareana.org", description: "Dallas Area NA." },
  "Central Texas NA (Austin)": { type: "NA", format: "BMLT", state: "TX", region: "Austin/Central TX", url: "https://ctana.org", description: "Central Texas Area NA. Helpline: 512-480-0004." },
  "Utah NA": { type: "NA", format: "BMLT", state: "UT", region: "Utah", url: "https://nautah.org", description: "Utah Region NA." },
  "Chesapeake Potomac VA NA": { type: "NA", format: "BMLT", state: "VA", region: "Northern VA/DC/MD", url: "https://cprna.org", description: "Chesapeake & Potomac Region NA." },
  "Northeast Washington NA": { type: "NA", format: "BMLT", state: "WA", region: "Spokane/NE WA", url: "https://newana.org", description: "Northeast Washington Area NA." },
  "Metro Milwaukee NA": { type: "NA", format: "BMLT", state: "WI", region: "Milwaukee", url: "https://namilwaukee.org", description: "Metro Milwaukee NA meetings." },

  // === VIRTUAL/ONLINE ===
  "Virtual NA (Online)": { type: "NA", format: "BMLT", state: "ONLINE", region: "Virtual/Online", url: "https://virtual-na.org", description: "Virtual NA meetings - accessible worldwide." },
};

// State full names - all US states plus territories
const stateNames = {
  // States
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming",
  // Territories & Special
  DC: "District of Columbia", PR: "Puerto Rico", VI: "Virgin Islands",
  GU: "Guam", AS: "American Samoa", MP: "Northern Mariana Islands",
  ONLINE: "Online/Virtual"
};

function FeedDetailPanel({ feed, isOpen, onClose }) {
  const [feedHistory, setFeedHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchFeedHistory = useCallback(async (feedName) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/history/feed/${encodeURIComponent(feedName)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const data = await response.json();
        setFeedHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching feed history:', error);
      setFeedHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && feed?.name && showHistory) {
      fetchFeedHistory(feed.name);
    }
  }, [isOpen, feed?.name, showHistory, fetchFeedHistory]);

  useEffect(() => {
    if (!isOpen) {
      setShowHistory(false);
      setFeedHistory([]);
    }
  }, [isOpen]);

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!feed) return null;

  const feedName = feed.name;
  const metadata = feedMetadata[feedName] || {
    type: feed.type || 'Unknown',
    format: feed.format || 'Unknown',
    state: feed.state || 'Unknown',
    region: feed.region || 'Unknown',
    url: feed.url || null,
    description: null
  };

  // Merge feed data with metadata
  const sourceInfo = {
    ...metadata,
    type: metadata.type || feed.type || 'Unknown',
    state: metadata.state || feed.state || 'Unknown',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`feed-panel-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`feed-detail-panel ${isOpen ? 'open' : ''}`}>
        <div className="feed-panel-header">
          <div className="feed-panel-title">
            <h3>{feedName}</h3>
            <span className={`feed-badge-type ${sourceInfo.type.toLowerCase()}`}>{sourceInfo.type}</span>
          </div>
          <button className="feed-panel-close" onClick={onClose} aria-label="Close panel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="feed-panel-body">
          {/* Status Section */}
          <div className="feed-section">
            <div className="feed-status-card">
              <span className="feed-status-indicator active"></span>
              <span className="feed-status-text">Active</span>
              <span className="feed-status-description">This source is enabled and will be scraped</span>
            </div>
          </div>

          {/* Description Section */}
          {sourceInfo.description && (
            <div className="feed-section">
              <h4>About This Source</h4>
              <p className="feed-description">{sourceInfo.description}</p>
            </div>
          )}

          {/* Coverage Area Section */}
          <div className="feed-section">
            <h4>Coverage Area</h4>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">Region</span>
                <span className="feed-detail-value">{sourceInfo.region}</span>
              </div>
            </div>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                  <line x1="8" y1="2" x2="8" y2="18"/>
                  <line x1="16" y1="6" x2="16" y2="22"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">State</span>
                <span className="feed-detail-value">
                  {stateNames[sourceInfo.state] || sourceInfo.state} ({sourceInfo.state})
                </span>
              </div>
            </div>
          </div>

          {/* Technical Details Section */}
          <div className="feed-section">
            <h4>Technical Details</h4>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">Data Format</span>
                <span className="feed-detail-value">
                  {sourceInfo.format === 'TSML' ? 'TSML (12 Step Meeting List)' :
                   sourceInfo.format === 'BMLT' ? 'BMLT (Basic Meeting List Toolkit)' :
                   sourceInfo.format}
                </span>
              </div>
            </div>
            <div className="feed-detail-row">
              <span className="feed-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </span>
              <div className="feed-detail-content">
                <span className="feed-detail-label">Meeting Type</span>
                <span className="feed-detail-value">
                  {sourceInfo.type === 'AA' ? 'Alcoholics Anonymous' :
                   sourceInfo.type === 'NA' ? 'Narcotics Anonymous' :
                   sourceInfo.type}
                </span>
              </div>
            </div>
            {sourceInfo.url && (
              <div className="feed-detail-row">
                <span className="feed-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
                <div className="feed-detail-content">
                  <span className="feed-detail-label">Source Website</span>
                  <a
                    href={sourceInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="feed-detail-link"
                  >
                    {sourceInfo.url.replace(/^https?:\/\//, '').replace(/\/$/, '').substring(0, 40)}
                    {sourceInfo.url.length > 50 ? '...' : ''}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15,3 21,3 21,9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Format Information Section */}
          <div className="feed-section">
            <h4>About {sourceInfo.format} Format</h4>
            <div className="feed-format-info">
              {sourceInfo.format === 'TSML' ? (
                <>
                  <p>
                    <strong>TSML (12 Step Meeting List)</strong> is a standardized JSON format
                    used by many AA intergroups and central offices to share meeting data.
                  </p>
                  <ul className="feed-format-features">
                    <li>Standardized meeting data structure</li>
                    <li>Includes meeting types and formats</li>
                    <li>Geographic coordinates when available</li>
                    <li>Online/hybrid meeting support</li>
                  </ul>
                </>
              ) : sourceInfo.format === 'BMLT' ? (
                <>
                  <p>
                    <strong>BMLT (Basic Meeting List Toolkit)</strong> is an open-source
                    meeting list server used primarily by NA service bodies.
                  </p>
                  <ul className="feed-format-features">
                    <li>REST API for meeting queries</li>
                    <li>Supports geographic searches</li>
                    <li>Real-time data updates</li>
                    <li>Multi-language support</li>
                  </ul>
                </>
              ) : (
                <p>Custom data format specific to this source.</p>
              )}
            </div>
          </div>

          {/* Actions Section */}
          <div className="feed-section feed-actions-section">
            <h4>Actions</h4>
            <div className="feed-actions">
              {sourceInfo.url && (
                <a
                  href={sourceInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feed-action-btn"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  Visit Source Website
                </a>
              )}
              <button
                className={`feed-action-btn feed-action-secondary ${showHistory ? 'active' : ''}`}
                onClick={() => setShowHistory(!showHistory)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18"/>
                  <path d="M9 21V9"/>
                </svg>
                {showHistory ? 'Hide Scrape History' : 'View Scrape History'}
              </button>
            </div>
          </div>

          {/* Scrape History Section */}
          {showHistory && (
            <div className="feed-section feed-history-section">
              <h4>Scrape History for This Source</h4>
              {isLoadingHistory ? (
                <div className="feed-history-loading">Loading history...</div>
              ) : feedHistory.length === 0 ? (
                <div className="feed-history-empty">
                  <p>No scrape history for this source yet.</p>
                  <p className="feed-history-hint">Run the scraper with this source selected to see history appear here.</p>
                </div>
              ) : (
                <div className="feed-history-list">
                  {feedHistory.map((entry, index) => (
                    <div key={entry.id || index} className="feed-history-entry">
                      <div className="feed-history-entry-header">
                        <span className={`feed-history-status status-${entry.status}`}>
                          {entry.status === 'completed' ? 'Completed' :
                           entry.status === 'in_progress' ? 'In Progress' :
                           entry.status === 'stopped' ? 'Stopped' : entry.status}
                        </span>
                        <span className="feed-history-date">{formatDate(entry.completed_at || entry.started_at)}</span>
                      </div>
                      <div className="feed-history-stats">
                        <span className="feed-history-stat">
                          <strong>{entry.found}</strong> found
                        </span>
                        <span className="feed-history-stat">
                          <strong>{entry.saved}</strong> saved
                        </span>
                        <span className="feed-history-stat">
                          <strong>{entry.duplicates}</strong> duplicates
                        </span>
                        {entry.errors > 0 && (
                          <span className="feed-history-stat feed-history-stat-error">
                            <strong>{entry.errors}</strong> errors
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default FeedDetailPanel;
