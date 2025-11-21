import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  // Redirect based on role
  const role = session.user.role;

  if (role === 'admin') {
    redirect('/admin/dashboard');
  } else if (role === 'employee') {
    redirect('/employee/dashboard');
  } else if (role === 'client') {
    redirect('/client/dashboard');
  } else if (role === 'hackathon') {
    redirect('/hackathon/dashboard');
  }

  // Default fallback
  redirect('/login');
}
