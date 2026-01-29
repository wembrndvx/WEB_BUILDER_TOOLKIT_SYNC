/**
 * TaskMonitor - Mock API Server
 *
 * Endpoints:
 * - GET /api/app-info    : App info (MASTER)
 * - GET /api/filters     : Filter options (MASTER)
 * - GET /api/tasks       : Task list (PAGE)
 * - GET /api/status      : Status summary (PAGE)
 * - GET /api/activity    : Activity log (PAGE)
 *
 * Port: 4004
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4004;

app.use(cors());
app.use(express.json());

// ======================
// MOCK DATA
// ======================

const USERS = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
const TASK_TYPES = ['development', 'design', 'testing', 'deployment', 'review'];
const STATUSES = ['pending', 'in_progress', 'completed', 'failed'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

let taskIdCounter = 100;

function generateTask(id) {
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)];
    const type = TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)];
    const assignee = USERS[Math.floor(Math.random() * USERS.length)];
    const progress = status === 'completed' ? 100 :
                     status === 'pending' ? 0 :
                     status === 'failed' ? Math.floor(Math.random() * 50) :
                     Math.floor(Math.random() * 90) + 10;

    return {
        id: `TASK-${id}`,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Task #${id}`,
        type,
        status,
        priority,
        assignee,
        progress,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
    };
}

function generateTasks(count = 20) {
    return Array.from({ length: count }, (_, i) => generateTask(taskIdCounter++));
}

let cachedTasks = generateTasks(25);

// ======================
// MASTER ENDPOINTS
// ======================

/**
 * GET /api/app-info
 * Header component - App information and status
 */
app.get('/api/app-info', (req, res) => {
    const totalTasks = cachedTasks.length;
    const activeTasks = cachedTasks.filter(t => t.status === 'in_progress').length;

    res.json({
        success: true,
        data: {
            appName: 'TaskMonitor',
            version: '1.0.0',
            environment: 'development',
            totalTasks,
            activeTasks,
            serverStatus: 'healthy',
            lastSync: new Date().toISOString()
        }
    });
});

/**
 * GET /api/filters
 * Sidebar component - Available filter options
 */
app.get('/api/filters', (req, res) => {
    res.json({
        success: true,
        data: {
            statuses: [
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' }
            ],
            priorities: [
                { value: 'all', label: 'All Priorities' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' }
            ],
            types: [
                { value: 'all', label: 'All Types' },
                { value: 'development', label: 'Development' },
                { value: 'design', label: 'Design' },
                { value: 'testing', label: 'Testing' },
                { value: 'deployment', label: 'Deployment' },
                { value: 'review', label: 'Review' }
            ],
            assignees: [
                { value: 'all', label: 'All Assignees' },
                ...USERS.map(u => ({ value: u.toLowerCase(), label: u }))
            ]
        }
    });
});

// ======================
// PAGE ENDPOINTS
// ======================

/**
 * GET /api/tasks
 * TaskList component - Filtered task list
 * Query: status, priority, type, assignee
 */
app.get('/api/tasks', (req, res) => {
    const { status = 'all', priority = 'all', type = 'all', assignee = 'all' } = req.query;

    // Simulate some data changes
    if (Math.random() > 0.7) {
        const idx = Math.floor(Math.random() * cachedTasks.length);
        cachedTasks[idx] = {
            ...cachedTasks[idx],
            progress: Math.min(100, cachedTasks[idx].progress + Math.floor(Math.random() * 10)),
            updatedAt: new Date().toISOString()
        };
    }

    let filtered = [...cachedTasks];

    if (status !== 'all') {
        filtered = filtered.filter(t => t.status === status);
    }
    if (priority !== 'all') {
        filtered = filtered.filter(t => t.priority === priority);
    }
    if (type !== 'all') {
        filtered = filtered.filter(t => t.type === type);
    }
    if (assignee !== 'all') {
        filtered = filtered.filter(t => t.assignee.toLowerCase() === assignee);
    }

    res.json({
        success: true,
        data: filtered,
        meta: {
            total: filtered.length,
            filters: { status, priority, type, assignee }
        }
    });
});

/**
 * GET /api/status
 * StatusChart component - Status distribution summary
 */
app.get('/api/status', (req, res) => {
    const statusCounts = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0
    };

    cachedTasks.forEach(t => {
        statusCounts[t.status]++;
    });

    const priorityCounts = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
    };

    cachedTasks.forEach(t => {
        priorityCounts[t.priority]++;
    });

    res.json({
        success: true,
        data: {
            byStatus: [
                { name: 'Pending', value: statusCounts.pending, color: '#94a3b8' },
                { name: 'In Progress', value: statusCounts.in_progress, color: '#3b82f6' },
                { name: 'Completed', value: statusCounts.completed, color: '#10b981' },
                { name: 'Failed', value: statusCounts.failed, color: '#ef4444' }
            ],
            byPriority: [
                { name: 'Low', value: priorityCounts.low, color: '#94a3b8' },
                { name: 'Medium', value: priorityCounts.medium, color: '#f59e0b' },
                { name: 'High', value: priorityCounts.high, color: '#f97316' },
                { name: 'Critical', value: priorityCounts.critical, color: '#ef4444' }
            ],
            total: cachedTasks.length
        },
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/activity
 * ActivityLog component - Recent activity log
 * Query: limit
 */
app.get('/api/activity', (req, res) => {
    const { limit = 10 } = req.query;
    const actions = ['created', 'updated', 'completed', 'assigned', 'commented'];

    const activities = Array.from({ length: parseInt(limit) }, (_, i) => {
        const task = cachedTasks[Math.floor(Math.random() * cachedTasks.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const user = USERS[Math.floor(Math.random() * USERS.length)];

        return {
            id: `ACT-${Date.now()}-${i}`,
            taskId: task.id,
            taskTitle: task.title,
            action,
            user,
            timestamp: new Date(Date.now() - i * 1000 * 60 * (Math.random() * 30 + 1)).toISOString()
        };
    });

    res.json({
        success: true,
        data: activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        meta: {
            count: activities.length
        }
    });
});

// ======================
// SERVER START
// ======================

app.listen(PORT, () => {
    console.log(`
===============================================
  TaskMonitor - Mock API Server
===============================================
  Server running at: http://localhost:${PORT}
-----------------------------------------------
  MASTER Endpoints:
    GET /api/app-info  - App information
    GET /api/filters   - Filter options
-----------------------------------------------
  PAGE Endpoints:
    GET /api/tasks     - Task list (?status=&priority=&type=&assignee=)
    GET /api/status    - Status distribution
    GET /api/activity  - Activity log (?limit=10)
===============================================
    `);
});
