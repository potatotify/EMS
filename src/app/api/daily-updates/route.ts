import {NextResponse} from "next/server";
import {getServerSession} from "next-auth/next";
import {authOptions} from "../auth/[...nextauth]/route";
import clientPromise, {dbConnect} from "@/lib/mongodb";
import {DailyUpdate, User} from "@/models";
import {ObjectId} from "mongodb";

export async function POST(request: Request) {
  try {
    await dbConnect();
    console.log("Daily update POST request received");

    const session = await getServerSession(authOptions);
    console.log("Session:", session ? "Found" : "Not found");

    if (!session?.user) {
      console.error("Unauthorized - No session or user");
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    // Try to find user by email first, then by ID if email lookup fails
    let user = await User.findOne({email: session.user.email});
    console.log("User found by email:", user ? "Yes" : "No");
    
    if (!user && session.user.id) {
      try {
        user = await User.findById(session.user.id);
        console.log("User found by ID:", user ? "Yes" : "No");
      } catch (e) {
        console.error("Error finding user by ID:", e);
      }
    }

    if (!user) {
      console.error("User not found - Email:", session.user.email, "ID:", session.user.id);
      return NextResponse.json({error: "User not found", email: session.user.email}, {status: 404});
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingUpdate = await DailyUpdate.findOne({
      employeeId: user._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    console.log("Existing update found:", existingUpdate ? "Yes" : "No");

    let data;
    try {
      data = await request.json();
      console.log("Request data parsed successfully");
    } catch (parseError) {
      console.error("Error parsing request JSON:", parseError);
      return NextResponse.json(
        {error: "Invalid JSON in request body", details: parseError instanceof Error ? parseError.message : String(parseError)},
        {status: 400}
      );
    }

    // Ensure checklist is an array
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    console.log("Checklist items:", checklist.length);

    const updateData: any = {
      checklist: checklist,
      tasksForTheDay: data.tasksForTheDay || "",
      hoursWorked: data.hoursWorked !== undefined ? Number(data.hoursWorked) : 0,
      additionalNotes: data.additionalNotes || "",
      status: "submitted",
      lastModified: new Date()
    };

    // Set legacy fields to false/default if not provided
    updateData.workedOnProject = data.workedOnProject || false;
    updateData.updatedDailyProgress = data.updatedDailyProgress || false;
    updateData.recordedLoomVideos = data.recordedLoomVideos || false;
    updateData.updatedClient = data.updatedClient || false;
    updateData.completedAllTasks = data.completedAllTasks || false;

    let dailyUpdate;

    try {
      if (existingUpdate) {
        console.log("Updating existing daily update:", existingUpdate._id);
        // Update existing record
        dailyUpdate = await DailyUpdate.findByIdAndUpdate(
          existingUpdate._id,
          updateData,
          {new: true, runValidators: true}
        );
        console.log("Update successful");
      } else {
        console.log("Creating new daily update");
        // Create new record
        dailyUpdate = new DailyUpdate({
          employeeId: user._id,
          date: new Date(),
          ...updateData
        });
        await dailyUpdate.save();
        console.log("Save successful");
      }

      return NextResponse.json({
        success: true,
        dailyUpdate: dailyUpdate.toObject ? dailyUpdate.toObject() : dailyUpdate
      });
    } catch (dbError: any) {
      console.error("Database operation error:", dbError);
      
      // Handle Mongoose validation errors
      if (dbError.name === 'ValidationError') {
        const validationErrors: any = {};
        if (dbError.errors) {
          Object.keys(dbError.errors).forEach(key => {
            validationErrors[key] = dbError.errors[key].message;
          });
        }
        return NextResponse.json(
          {
            error: "Validation failed",
            details: dbError.message,
            validationErrors
          },
          {status: 400}
        );
      }

      // Handle other Mongoose errors
      if (dbError.name === 'CastError') {
        return NextResponse.json(
          {
            error: "Invalid data format",
            details: dbError.message
          },
          {status: 400}
        );
      }

      throw dbError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("Error saving daily update:", error);
    
    let errorMessage = "Unknown error";
    let errorDetails: any = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    } else {
      errorMessage = String(error);
      errorDetails = { raw: String(error) };
    }
    
    return NextResponse.json(
      {
        error: "Failed to save daily update",
        details: errorMessage,
        ...errorDetails
      },
      {status: 500}
    );
  }
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const {searchParams} = new URL(request.url);
    const date = searchParams.get("date");
    const employeeId = searchParams.get("employeeId");

    console.log("Query params - date:", date, "employeeId:", employeeId);

    const session = await getServerSession(authOptions);
    console.log("Session:", session?.user?.email);

    if (!session?.user) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const user = await User.findOne({email: session.user.email});

    if (!user) {
      return NextResponse.json({error: "User not found"}, {status: 404});
    }

    // Admins can view any employee's updates, others can only view their own
    const isAdmin = user.role === "admin";

    const query: any = {};

    // If not admin, only show their own updates
    if (!isAdmin) {
      query.employeeId = user._id;
    } else if (employeeId) {
      // If admin and specific employee is requested, filter by that employee
      // Validate if it's a valid MongoDB ObjectId
      if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
        // First, check if this is an employeeProfile ID and get the actual user ID
        const client = await clientPromise;
        const db = client.db("worknest");
        const employeeProfile = await db
          .collection("employeeProfiles")
          .findOne({
            _id: new ObjectId(employeeId)
          });

        if (employeeProfile && employeeProfile.userId) {
          // Use the userId from employeeProfile
          query.employeeId = employeeProfile.userId;
          console.log(
            "Found employee profile, using userId:",
            employeeProfile.userId
          );
        } else {
          // If no profile found, try using the ID directly as userId
          query.employeeId = employeeId;
        }
      } else {
        // If not a valid ObjectId, return empty (strict employee ID search)
        return NextResponse.json([]); // Return empty array if not valid ObjectId
      }
    }
    // If admin and no specific employee, show all updates

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    const updates = await DailyUpdate.find(query)
      .sort({date: -1})
      .limit(100) // Limit to 100 records to prevent slowdowns
      .populate("employeeId", "name email");

    return NextResponse.json(updates);
  } catch (error) {
    console.error("Error fetching daily updates:", error);
    return NextResponse.json(
      {error: "Failed to fetch daily updates", details: String(error)},
      {status: 500}
    );
  }
}
