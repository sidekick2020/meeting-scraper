import React, { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Cache keys and TTL
const TASKS_CACHE_KEY = 'tasks:data';
const DRYSPOTS_CACHE_KEY = 'tasks:drySpots';
const TASKS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function TasksPanel({ feeds }) {
  const { getCache, setCache } = useDataCache();
  const cachedTasks = getCache(TASKS_CACHE_KEY);
  const cachedDrySpots = getCache(DRYSPOTS_CACHE_KEY);

  const [tasks, setTasks] = useState(cachedTasks?.data || []);
  const [drySpots, setDrySpots] = useState(cachedDrySpots?.data || []);
  const [isLoading, setIsLoading] = useState(!cachedTasks?.data && !cachedDrySpots?.data);
  const [isResearching, setIsResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Script generation state
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptModalData, setScriptModalData] = useState(null);
  const [generatedScript, setGeneratedScript] = useState('');
  const [scriptFeedConfig, setScriptFeedConfig] = useState(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceState, setSourceState] = useState('');
  const [feedType, setFeedType] = useState('auto');

  // Fetch tasks and dry spots
  const fetchTasks = useCallback(async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedTasks?.data && cachedTasks.data.length > 0) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`);
      if (response.ok) {
        const data = await response.json();
        const tasksData = data.tasks || [];
        setTasks(tasksData);
        // Cache the data
        setCache(TASKS_CACHE_KEY, tasksData, TASKS_CACHE_TTL);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, [cachedTasks, setCache]);

  const fetchDrySpots = useCallback(async (forceRefresh = false) => {
    // Skip if we have cached data and not forcing refresh
    if (!forceRefresh && cachedDrySpots?.data && cachedDrySpots.data.length > 0) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/coverage/gaps`);
      if (response.ok) {
        const data = await response.json();
        const gapsData = data.gaps || [];
        setDrySpots(gapsData);
        // Cache the data
        setCache(DRYSPOTS_CACHE_KEY, gapsData, TASKS_CACHE_TTL);
      }
    } catch (error) {
      console.error('Error fetching dry spots:', error);
    }
  }, [cachedDrySpots, setCache]);

  useEffect(() => {
    const loadData = async () => {
      // Only show loading if no cached data
      if (!cachedTasks?.data && !cachedDrySpots?.data) {
        setIsLoading(true);
      }
      await Promise.all([fetchTasks(), fetchDrySpots()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchTasks, fetchDrySpots, cachedTasks, cachedDrySpots]);

  // Research intergroup sites for a dry spot
  const researchDrySpot = async (spot) => {
    setIsResearching(true);
    setResearchProgress('Searching for intergroup websites...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: spot.state,
          region: spot.region || spot.city,
          type: 'intergroup_search'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResearchProgress('Research complete!');

        // Add new tasks from research immediately
        if (data.suggestions && data.suggestions.length > 0) {
          setTasks(prev => [...data.suggestions, ...prev]);
        }

        // Invalidate cache if server indicates data changed
        if (data.cache_invalidated) {
          invalidateTasksCache();
        }

        setTimeout(() => {
          setIsResearching(false);
          setResearchProgress('');
        }, 1500);
      } else {
        setResearchProgress('Research failed. Please try again.');
        setTimeout(() => {
          setIsResearching(false);
          setResearchProgress('');
        }, 2000);
      }
    } catch (error) {
      console.error('Error researching:', error);
      setResearchProgress('Error during research. Please try again.');
      setTimeout(() => {
        setIsResearching(false);
        setResearchProgress('');
      }, 2000);
    }
  };

  // Helper to invalidate task cache
  const invalidateTasksCache = useCallback(() => {
    setCache(TASKS_CACHE_KEY, null, 0);
  }, [setCache]);

  // Update task status
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state immediately for fast UI
        setTasks(prev => prev.map(task =>
          task.id === taskId ? { ...task, status: newStatus } : task
        ));
        // Invalidate cache if server indicates data changed
        if (data.cache_invalidated) {
          invalidateTasksCache();
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Delete task
  const deleteTask = async (taskId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state immediately for fast UI
        setTasks(prev => prev.filter(task => task.id !== taskId));
        // Invalidate cache if server indicates data changed
        if (data.cache_invalidated) {
          invalidateTasksCache();
        }
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Add manual task
  const addManualTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription,
          type: 'manual',
          status: 'pending'
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state immediately for fast UI
        setTasks(prev => [data.task, ...prev]);
        setNewTaskTitle('');
        setNewTaskDescription('');
        setShowAddTask(false);
        // Invalidate cache if server indicates data changed
        if (data.cache_invalidated) {
          invalidateTasksCache();
        }
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  // Run research on all uncovered sources
  const researchAllDrySpots = async () => {
    setIsResearching(true);
    setResearchProgress('Analyzing coverage gaps...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/research-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setResearchProgress(`Found ${data.suggestionsCount || 0} potential sources!`);

        // Add new tasks directly to state for immediate UI update
        if (data.tasks && data.tasks.length > 0) {
          setTasks(prev => [...data.tasks, ...prev]);
        }

        // Invalidate cache if server indicates data changed
        if (data.cache_invalidated) {
          invalidateTasksCache();
        }

        setTimeout(() => {
          setIsResearching(false);
          setResearchProgress('');
        }, 1500);
      } else {
        setResearchProgress('Research failed. Please try again.');
        setTimeout(() => {
          setIsResearching(false);
          setResearchProgress('');
        }, 2000);
      }
    } catch (error) {
      console.error('Error researching:', error);
      setResearchProgress('Error during research. Please try again.');
      setTimeout(() => {
        setIsResearching(false);
        setResearchProgress('');
      }, 2000);
    }
  };

  // Generate script for a task
  const generateScript = async (task) => {
    // Pre-fill based on task data
    const state = task.state || '';
    const name = task.title?.replace(/^(Add |Research |Check )/, '') || '';

    setShowScriptModal(true);
    setScriptModalData(task);
    setSourceName(name);
    setSourceState(state);
    setSourceUrl('');
    setFeedType('auto');
    setGeneratedScript('');
    setTestResults(null);
    setScriptFeedConfig(null);
  };

  // Request script generation from backend
  const requestScriptGeneration = async () => {
    if (!sourceUrl.trim()) return;

    setIsGeneratingScript(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          name: sourceName || 'New Meeting Source',
          state: sourceState || 'XX',
          feedType: feedType
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedScript(data.script);
        setScriptFeedConfig(data.feedConfig);
        setFeedType(data.feedType);
      } else {
        const error = await response.json();
        alert(`Error generating script: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating script:', error);
      alert('Failed to generate script. Please try again.');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Test the source URL
  const testSource = async () => {
    if (!sourceUrl.trim()) return;

    setIsTesting(true);
    setTestResults(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/test-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          feedType: feedType,
          state: sourceState || 'XX'
        })
      });

      const data = await response.json();
      setTestResults(data);

      // Update feed type if auto-detected
      if (data.feedType) {
        setFeedType(data.feedType);
      }
    } catch (error) {
      console.error('Error testing source:', error);
      setTestResults({
        success: false,
        error: 'Failed to test source. Please try again.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Add the source to feeds
  const addToSources = async () => {
    if (!sourceUrl.trim() || !sourceName.trim() || !sourceState.trim()) {
      alert('Please fill in all fields (URL, Name, and State)');
      return;
    }

    setIsAddingSource(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/add-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          name: sourceName,
          state: sourceState,
          feedType: feedType === 'auto' ? 'tsml' : feedType
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Success! "${sourceName}" has been added to the feeds.`);

        // Mark the associated task as completed
        if (scriptModalData?.id) {
          await updateTaskStatus(scriptModalData.id, 'completed');
        }

        setShowScriptModal(false);
        resetScriptModal();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error adding source:', error);
      alert('Failed to add source. Please try again.');
    } finally {
      setIsAddingSource(false);
    }
  };

  // Reset script modal state
  const resetScriptModal = () => {
    setScriptModalData(null);
    setGeneratedScript('');
    setScriptFeedConfig(null);
    setTestResults(null);
    setSourceUrl('');
    setSourceName('');
    setSourceState('');
    setFeedType('auto');
  };

  // Copy script to clipboard
  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    alert('Script copied to clipboard!');
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  const taskCounts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  // Get existing source states for comparison
  const existingStates = new Set(feeds?.map(f => f.state) || []);

  if (isLoading) {
    return (
      <div className="skeleton-tasks-container">
        {/* Skeleton Header */}
        <div className="skeleton-tasks-header">
          <div className="skeleton-tasks-header-left">
            <div className="skeleton-tasks-title"></div>
            <div className="skeleton-tasks-subtitle"></div>
          </div>
          <div className="skeleton-tasks-actions">
            <div className="skeleton-tasks-btn"></div>
            <div className="skeleton-tasks-btn" style={{ width: '150px' }}></div>
          </div>
        </div>

        {/* Skeleton Coverage Gaps Section */}
        <div className="skeleton-tasks-section">
          <div className="skeleton-section-header">
            <div className="skeleton-section-title"></div>
            <div className="skeleton-section-count"></div>
          </div>
          <div className="skeleton-dry-spots-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-dry-spot-card">
                <div className="skeleton-dry-spot-info">
                  <div className="skeleton-dry-spot-state"></div>
                  <div className="skeleton-dry-spot-stats"></div>
                </div>
                <div className="skeleton-dry-spot-btn"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton Tasks Section */}
        <div className="skeleton-tasks-section">
          <div className="skeleton-section-header">
            <div className="skeleton-section-title" style={{ width: '60px' }}></div>
            <div className="skeleton-task-filters">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-filter-btn"></div>
              ))}
            </div>
          </div>
          <div className="skeleton-tasks-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-task-card">
                <div className="skeleton-task-checkbox"></div>
                <div className="skeleton-task-content">
                  <div className="skeleton-task-title"></div>
                  <div className="skeleton-task-meta">
                    <div className="skeleton-task-tag"></div>
                    <div className="skeleton-task-tag" style={{ width: '60px' }}></div>
                  </div>
                </div>
                <div className="skeleton-task-actions">
                  <div className="skeleton-task-action-btn"></div>
                  <div className="skeleton-task-action-btn"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-panel">
      {/* Header with actions */}
      <div className="tasks-header">
        <div className="tasks-header-left">
          <h2>Research Tasks</h2>
          <p className="tasks-subtitle">
            Find and add new meeting sources to expand coverage
          </p>
        </div>
        <div className="tasks-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowAddTask(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Task
          </button>
          <button
            className="btn btn-primary"
            onClick={researchAllDrySpots}
            disabled={isResearching}
          >
            {isResearching ? (
              <>
                <span className="btn-spinner"></span>
                Researching...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                Find New Sources
              </>
            )}
          </button>
        </div>
      </div>

      {/* Research progress */}
      {isResearching && researchProgress && (
        <div className="research-progress">
          <div className="research-progress-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <span>{researchProgress}</span>
        </div>
      )}

      {/* Dry spots section */}
      <div className="tasks-section">
        <div className="section-header">
          <h3>Coverage Gaps</h3>
          <span className="section-count">{drySpots.length} areas need sources</span>
        </div>

        {drySpots.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
            <p>Great coverage! No major gaps detected.</p>
          </div>
        ) : (
          <div className="dry-spots-grid">
            {drySpots.map((spot, index) => (
              <div
                key={index}
                className={`dry-spot-card ${existingStates.has(spot.state) ? 'has-some-coverage' : 'no-coverage'}`}
              >
                <div className="dry-spot-info">
                  <div className="dry-spot-location">
                    <span className="dry-spot-state">{spot.state}</span>
                    {spot.region && <span className="dry-spot-region">{spot.region}</span>}
                  </div>
                  <div className="dry-spot-stats">
                    <span className="stat">
                      <strong>{spot.meetingCount || 0}</strong> meetings
                    </span>
                    {spot.population && (
                      <span className="stat">
                        <strong>{(spot.population / 1000000).toFixed(1)}M</strong> population
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => researchDrySpot(spot)}
                  disabled={isResearching}
                  title="Research intergroup sites for this area"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks list */}
      <div className="tasks-section">
        <div className="section-header">
          <h3>Tasks</h3>
          <div className="task-filters">
            {['all', 'pending', 'in_progress', 'completed'].map(status => (
              <button
                key={status}
                className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="filter-count">{taskCounts[status]}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            <p>No tasks yet. Click "Find New Sources" to discover meeting feeds.</p>
          </div>
        ) : (
          <div className="tasks-list">
            {filteredTasks.map(task => (
              <div key={task.id} className={`task-card task-${task.status}`}>
                <div className="task-checkbox">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                  />
                  <span className="checkbox-custom"></span>
                </div>
                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  {task.description && (
                    <div className="task-description">{task.description}</div>
                  )}
                  {task.url && (
                    <a href={task.url} target="_blank" rel="noopener noreferrer" className="task-url">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <polyline points="15,3 21,3 21,9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      {task.url}
                    </a>
                  )}
                  <div className="task-meta">
                    {task.state && <span className="task-tag">{task.state}</span>}
                    {task.type && <span className="task-tag task-tag-type">{task.type}</span>}
                    {task.source && <span className="task-source">via {task.source}</span>}
                  </div>
                </div>
                <div className="task-actions">
                  {task.status !== 'completed' && (task.type === 'research' || task.type === 'source_needed') && (
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={() => generateScript(task)}
                      title="Generate scraping script"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16,18 22,12 16,6"/>
                        <polyline points="8,6 2,12 8,18"/>
                      </svg>
                    </button>
                  )}
                  {task.status !== 'in_progress' && task.status !== 'completed' && (
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      title="Mark as in progress"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                    </button>
                  )}
                  <button
                    className="btn btn-xs btn-ghost btn-danger"
                    onClick={() => deleteTask(task.id)}
                    title="Delete task"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add task modal */}
      {showAddTask && (
        <div className="modal-overlay">
          <div className="modal add-task-modal">
            <h2>Add New Task</h2>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g., Add Phoenix AA intergroup feed"
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Additional details or notes..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAddTask(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={addManualTask}
                disabled={!newTaskTitle.trim()}
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script generation modal */}
      {showScriptModal && (
        <div className="modal-overlay">
          <div className="modal script-modal">
            <div className="script-modal-header">
              <h2>Add Meeting Source</h2>
              <button
                className="btn btn-ghost btn-close"
                onClick={() => { setShowScriptModal(false); resetScriptModal(); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {scriptModalData && (
              <div className="script-task-info">
                <span className="task-tag">{scriptModalData.state}</span>
                <span className="task-title-small">{scriptModalData.title}</span>
              </div>
            )}

            {/* Step 1: Enter source details */}
            <div className="script-section">
              <h3>1. Enter Source Details</h3>
              <div className="script-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Source Name</label>
                    <input
                      type="text"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder="e.g., Phoenix AA Intergroup"
                    />
                  </div>
                  <div className="form-group form-group-small">
                    <label>State</label>
                    <input
                      type="text"
                      value={sourceState}
                      onChange={(e) => setSourceState(e.target.value.toUpperCase())}
                      placeholder="AZ"
                      maxLength={2}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Feed URL</label>
                  <input
                    type="text"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.org/wp-admin/admin-ajax.php?action=meetings"
                  />
                  <span className="form-hint">
                    TSML: /wp-admin/admin-ajax.php?action=meetings | BMLT: /main_server/client_interface/json/
                  </span>
                </div>
                <div className="form-group form-group-small">
                  <label>Feed Type</label>
                  <select value={feedType} onChange={(e) => setFeedType(e.target.value)}>
                    <option value="auto">Auto-detect</option>
                    <option value="tsml">TSML (AA)</option>
                    <option value="bmlt">BMLT (NA)</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Test the source */}
            <div className="script-section">
              <h3>2. Test the Source</h3>
              <div className="script-actions">
                <button
                  className="btn btn-secondary"
                  onClick={testSource}
                  disabled={!sourceUrl.trim() || isTesting}
                >
                  {isTesting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Testing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <polyline points="22,4 12,14.01 9,11.01"/>
                      </svg>
                      Test Source
                    </>
                  )}
                </button>
              </div>

              {testResults && (
                <div className={`test-results ${testResults.success ? 'success' : 'error'}`}>
                  {testResults.success ? (
                    <>
                      <div className="test-results-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                        <span>Success! Found {testResults.totalMeetings} meetings</span>
                      </div>
                      <div className="test-details">
                        <div className="test-detail">
                          <strong>Feed Type:</strong> {testResults.feedType?.toUpperCase()}
                        </div>
                        {testResults.stateBreakdown && (
                          <div className="test-detail">
                            <strong>By State:</strong>{' '}
                            {Object.entries(testResults.stateBreakdown).map(([st, count]) => (
                              <span key={st} className="state-tag">{st}: {count}</span>
                            ))}
                          </div>
                        )}
                        {testResults.sampleMeetings && (
                          <div className="test-sample">
                            <strong>Sample Meetings:</strong>
                            <ul>
                              {testResults.sampleMeetings.map((m, i) => (
                                <li key={i}>
                                  {m.name} - {m.city}, {m.state}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="test-results-header error">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>Test Failed</span>
                      </div>
                      <div className="test-error">
                        <p>{testResults.error}</p>
                        {testResults.hint && <p className="test-hint">{testResults.hint}</p>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Generate script (optional) */}
            <div className="script-section">
              <h3>3. Generate Script (Optional)</h3>
              <div className="script-actions">
                <button
                  className="btn btn-ghost"
                  onClick={requestScriptGeneration}
                  disabled={!sourceUrl.trim() || isGeneratingScript}
                >
                  {isGeneratingScript ? (
                    <>
                      <span className="btn-spinner"></span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="16,18 22,12 16,6"/>
                        <polyline points="8,6 2,12 8,18"/>
                      </svg>
                      Generate Python Script
                    </>
                  )}
                </button>
              </div>

              {generatedScript && (
                <div className="script-output">
                  <div className="script-output-header">
                    <span>Python Scraping Script</span>
                    <button className="btn btn-xs btn-ghost" onClick={copyScript}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                      Copy
                    </button>
                  </div>
                  <pre className="script-code">{generatedScript}</pre>
                </div>
              )}
            </div>

            {/* Step 4: Add to sources */}
            <div className="script-section">
              <h3>4. Add to Sources</h3>
              <div className="script-actions">
                <button
                  className="btn btn-primary"
                  onClick={addToSources}
                  disabled={!testResults?.success || isAddingSource}
                >
                  {isAddingSource ? (
                    <>
                      <span className="btn-spinner"></span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Add to Sources
                    </>
                  )}
                </button>
                {!testResults?.success && (
                  <span className="form-hint">Test the source first to enable this button</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksPanel;
