import React, { useState, useEffect, useCallback } from 'react';
import { useDataCache } from '../contexts/DataCacheContext';
import TaskSidebar from './TaskSidebar';

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

  // Task sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

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

  // Open task in sidebar
  const openTaskSidebar = (task) => {
    setSelectedTask(task);
    setSidebarOpen(true);
  };

  // Close sidebar
  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedTask(null);
  };

  // Handle source added from sidebar
  const handleSourceAdded = (feedConfig) => {
    // Force refresh tasks to update status
    fetchTasks(true);
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
              <div
                key={task.id}
                className={`task-card task-${task.status} ${task.status !== 'completed' ? 'clickable' : ''}`}
                onClick={() => task.status !== 'completed' && openTaskSidebar(task)}
              >
                <div className="task-checkbox" onClick={(e) => e.stopPropagation()}>
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
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="task-url"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                  {task.status !== 'completed' && (task.type === 'research' || task.type === 'source_needed' || task.type === 'manual') && (
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={(e) => { e.stopPropagation(); openTaskSidebar(task); }}
                      title="Add source for this task"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  )}
                  {task.status !== 'in_progress' && task.status !== 'completed' && (
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'in_progress'); }}
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
                    onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
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

      {/* Task Sidebar for adding sources */}
      <TaskSidebar
        task={selectedTask}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        onTaskUpdate={updateTaskStatus}
        onSourceAdded={handleSourceAdded}
      />
    </div>
  );
}

export default TasksPanel;
