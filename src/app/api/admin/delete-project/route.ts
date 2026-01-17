import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId)
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete all related data in a transaction-like manner
    // 1. Get all task IDs for this project (to delete subtasks)
    const tasks = await db.collection('tasks').find({
      projectId: new ObjectId(projectId)
    }).project({ _id: 1 }).toArray();
    
    const taskIds = tasks.map((t: any) => t._id);

    // 2. Get all subtask IDs before deletion (for SubtaskCompletion cleanup)
    let subtaskIds: any[] = [];
    if (taskIds.length > 0) {
      const subtasks = await db.collection('subtasks').find({
        taskId: { $in: taskIds }
      }).project({ _id: 1 }).toArray();
      
      subtaskIds = subtasks.map((st: any) => st._id);
      
      // Delete all SubtaskCompletion records for subtasks of tasks in this project
      if (subtaskIds.length > 0) {
        const SubtaskCompletion = (await import("@/models/SubtaskCompletion")).default;
        const subtaskCompletionResult = await SubtaskCompletion.deleteMany({
          subtaskId: { $in: subtaskIds }
        });
        console.log(`[Delete Project] Deleted ${subtaskCompletionResult.deletedCount} SubtaskCompletion record(s) for project ${projectId}`);
      }
      
      // Delete all subtasks for tasks in this project
      const subtasksResult = await db.collection('subtasks').deleteMany({
        taskId: { $in: taskIds }
      });
      console.log(`[Delete Project] Deleted ${subtasksResult.deletedCount} subtask(s) for project ${projectId}`);
    }

    // 3. Delete all tasks related to this project
    await db.collection('tasks').deleteMany({
      projectId: new ObjectId(projectId)
    });

    // 4. Delete all task completions for tasks in this project
    await db.collection('taskcompletions').deleteMany({
      projectId: new ObjectId(projectId)
    });

    // 3. Delete all project updates
    await db.collection('projectupdates').deleteMany({
      projectId: new ObjectId(projectId)
    });

    // 4. Delete all daily updates related to this project
    await db.collection('dailyupdates').deleteMany({
      projectId: new ObjectId(projectId)
    });

    // 5. Delete project messages
    await db.collection('messages').deleteMany({
      projectId: new ObjectId(projectId)
    });

    // 6. Delete project meetings
    await db.collection('meetings').deleteMany({
      projectId: new ObjectId(projectId)
    });

    // 7. Delete notifications related to this project
    await db.collection('notifications').deleteMany({
      projectId: new ObjectId(projectId)
    });

    // 8. Finally, delete the project itself
    await db.collection('projects').deleteOne({
      _id: new ObjectId(projectId)
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Project and all related data deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
