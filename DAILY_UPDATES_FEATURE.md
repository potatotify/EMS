# Daily Updates Feature Documentation

## Overview
The Daily Updates feature allows employees to submit comprehensive daily progress reports and enables admins to review, score, and create a bonus leaderboard based on employee performance.

## Features Implemented

### 1. Daily Update Form (Employee Side)
- **Location**: `src/components/employee/DailyUpdateForm.tsx`
- **Functionality**:
  - Employees can submit daily updates with 40+ checkboxes and text fields
  - Organized into logical sections:
    - Daily Updates (attendance, work activities)
    - Project Management (deadlines, communication)
    - Freelancer Management
    - Additional Information (hours worked, notes)
  - Prevents duplicate submissions for the same day
  - Shows submission status

### 2. Daily Update Model
- **Location**: `src/models/DailyUpdate.ts`
- **Fields**:
  - Employee ID and date
  - Status tracking (pending, submitted, reviewed, approved)
  - 40+ boolean fields for daily activities
  - Admin review fields (score, notes, approval)
  - Timestamps for tracking

### 3. API Endpoints

#### POST `/api/daily-updates`
- Submit a new daily update
- Automatically checks for existing submissions for the day
- Updates existing record if already submitted

#### GET `/api/daily-updates`
- Fetch daily updates
- Supports filtering by date and employee ID
- Admins can view all employees' updates
- Employees can only view their own updates

#### GET/PUT `/api/daily-updates/[id]`
- Get a specific daily update
- Admin can review and update scores
- Only admins can modify admin-related fields

#### GET `/api/leaderboard`
- Fetch employee rankings
- Supports daily, weekly, and monthly periods
- Calculates scores based on submitted updates
- Returns ranked list with average scores

### 4. Admin Review Component
- **Location**: `src/components/admin/DailyUpdatesReview.tsx`
- **Features**:
  - View all submitted daily updates
  - Filter by date and employee
  - Review individual updates with visual checkboxes
  - Add admin notes and scores
  - Approve or reject updates
  - Save reviews and update status

### 5. Bonus Leaderboard Component
- **Location**: `src/components/admin/BonusLeaderboard.tsx`
- **Features**:
  - Display employee rankings
  - Show average scores and total scores
  - Support for daily, weekly, and monthly views
  - Visual ranking with medals (🥇🥈🥉)
  - Progress bars for score visualization

## Database Schema

### DailyUpdate Collection
```typescript
{
  employeeId: ObjectId,
  date: Date,
  status: 'pending' | 'submitted' | 'reviewed' | 'approved',
  score: Number,
  
  // Daily Updates
  attendedMorningSession: Boolean,
  cameOnTime: Boolean,
  workedOnProject: Boolean,
  askedForNewProject: Boolean,
  gotCodeCorrected: Boolean,
  updatedClient: Boolean,
  workedOnTrainingTask: Boolean,
  updatedSeniorTeam: Boolean,
  updatedDailyProgress: Boolean,
  plannedNextDayTask: Boolean,
  completedAllTasks: Boolean,
  workedOnMultipleProjects: Boolean,
  tasksForTheDay: String,
  
  // Project Management (20+ fields)
  informedUnableToComplete: Boolean,
  ensuredProjectReassigned: Boolean,
  // ... more fields
  
  // Admin Fields
  adminNotes: String,
  adminScore: Number,
  adminApproved: Boolean,
  lastModified: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

## Setup Instructions

### 1. Environment Variables
Add to `.env.local`:
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
NEXTAUTH_SECRET=<your-secret>
NEXTAUTH_URL=http://localhost:3000
```

### 2. Install Dependencies
```bash
npm install mongoose
```

### 3. Add to Employee Dashboard
Add to `src/app/employee/dashboard/page.tsx`:
```tsx
import DailyUpdateForm from '@/components/employee/DailyUpdateForm';

export default function EmployeeDashboard() {
  return (
    <div>
      {/* ... existing components ... */}
      <DailyUpdateForm />
    </div>
  );
}
```

### 4. Add to Admin Dashboard
Add to `src/app/admin/dashboard/page.tsx`:
```tsx
import DailyUpdatesReview from '@/components/admin/DailyUpdatesReview';
import BonusLeaderboard from '@/components/admin/BonusLeaderboard';

export default function AdminDashboard() {
  return (
    <div>
      {/* ... existing components ... */}
      <DailyUpdatesReview />
      <BonusLeaderboard />
    </div>
  );
}
```

## Scoring System

### Automatic Scoring
- Each checkbox in the daily update is worth 1 point
- Total possible points: 12 (from daily activities)
- Score is converted to percentage: (checked_items / 12) * 100

### Admin Scoring
- Admins can override with custom scores (0-100)
- Final score is average of automatic score and admin score
- Only approved updates count toward leaderboard

## Leaderboard Calculation

### Daily Leaderboard
- Includes updates from today only
- Employees ranked by average score

### Weekly Leaderboard
- Includes updates from the current week (Monday-Sunday)
- Calculates average across all updates in the week

### Monthly Leaderboard
- Includes updates from the current month
- Calculates average across all updates in the month

## Features to Consider Adding

1. **Notifications**: Alert admins when new updates are submitted
2. **Bulk Actions**: Allow admins to approve/reject multiple updates at once
3. **Export**: Export leaderboard data to CSV/Excel
4. **Bonus Calculation**: Automatically calculate bonuses based on scores
5. **Trends**: Show performance trends over time
6. **Alerts**: Flag unusual patterns or missing submissions
7. **Mobile App**: Mobile-friendly version for on-the-go submissions
8. **Reminders**: Send reminders to employees to submit daily updates

## API Response Examples

### Daily Update Response
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "employeeId": "507f1f77bcf86cd799439012",
  "date": "2024-11-19T00:00:00.000Z",
  "status": "submitted",
  "attendedMorningSession": true,
  "cameOnTime": true,
  "workedOnProject": true,
  "hoursWorked": 8,
  "adminScore": 85,
  "adminApproved": false,
  "createdAt": "2024-11-19T10:30:00.000Z",
  "updatedAt": "2024-11-19T10:30:00.000Z"
}
```

### Leaderboard Response
```json
[
  {
    "rank": 1,
    "employeeId": "507f1f77bcf86cd799439012",
    "employeeName": "John Doe",
    "email": "john@example.com",
    "averageScore": 92.5,
    "totalScore": 370,
    "updatesCount": 4
  },
  {
    "rank": 2,
    "employeeId": "507f1f77bcf86cd799439013",
    "employeeName": "Jane Smith",
    "email": "jane@example.com",
    "averageScore": 88.75,
    "totalScore": 355,
    "updatesCount": 4
  }
]
```

## Troubleshooting

### Issue: "Cannot find module '@/models/User'"
- Ensure User model exists at `src/models/User.ts`
- Check that TypeScript can resolve the path alias

### Issue: MongoDB Connection Error
- Verify MONGODB_URI is correct in `.env.local`
- Check MongoDB cluster is accessible
- Ensure network access is allowed

### Issue: Updates Not Saving
- Check browser console for errors
- Verify user is authenticated
- Check MongoDB connection status

## Files Created/Modified

### New Files Created:
- `src/models/DailyUpdate.ts` - Daily update schema
- `src/models/User.ts` - User schema
- `src/components/employee/DailyUpdateForm.tsx` - Employee form
- `src/components/admin/DailyUpdatesReview.tsx` - Admin review panel
- `src/components/admin/BonusLeaderboard.tsx` - Leaderboard display
- `src/app/api/daily-updates/route.ts` - Main API endpoint
- `src/app/api/daily-updates/[id]/route.ts` - Individual update endpoint
- `src/app/api/leaderboard/route.ts` - Leaderboard endpoint

### Modified Files:
- `src/lib/mongodb.ts` - Updated to use Mongoose
- `package.json` - Added mongoose dependency

## Next Steps

1. Integrate DailyUpdateForm into employee dashboard
2. Integrate DailyUpdatesReview and BonusLeaderboard into admin dashboard
3. Test the complete workflow
4. Configure MongoDB connection
5. Deploy to production
