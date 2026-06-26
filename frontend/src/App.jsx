import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import Employees from './pages/admin/Employees.jsx';
import EmployeeForm from './pages/admin/EmployeeForm.jsx';
import Departments from './pages/admin/Departments.jsx';
import Designations from './pages/admin/Designations.jsx';
import AdminAttendance from './pages/admin/AdminAttendance.jsx';
import LiveMap from './pages/admin/LiveMap.jsx';
import LiveStatus from './pages/admin/LiveStatus.jsx';
import Holidays from './pages/admin/Holidays.jsx';
import Shifts from './pages/admin/Shifts.jsx';
import Clients from './pages/admin/Clients.jsx';
import Purchases from './pages/admin/Purchases.jsx';
import Reports from './pages/admin/Reports.jsx';
import SecurityLogs from './pages/admin/SecurityLogs.jsx';
import Settings from './pages/admin/Settings.jsx';

import EmployeeDashboard from './pages/employee/EmployeeDashboard.jsx';
import MarkAttendance from './pages/employee/MarkAttendance.jsx';
import AttendanceHistory from './pages/employee/AttendanceHistory.jsx';

import Leaves from './pages/shared/Leaves.jsx';
import Regularize from './pages/shared/Regularize.jsx';
import MyTeam from './pages/shared/MyTeam.jsx';
import Calendar from './pages/shared/Calendar.jsx';
import Documents from './pages/shared/Documents.jsx';
import Payroll from './pages/shared/Payroll.jsx';
import NoticeBoard from './pages/shared/NoticeBoard.jsx';
import HolidayList from './pages/shared/HolidayList.jsx';
import Expenses from './pages/shared/Expenses.jsx';
import Tasks from './pages/shared/Tasks.jsx';
import Meetings from './pages/shared/Meetings.jsx';
import Tickets from './pages/shared/Tickets.jsx';
import Profile from './pages/shared/Profile.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-wrap">
        <div className="spinner-border text-light" role="status" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated shell */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Admin / HR */}
        <Route path="/admin" element={<ProtectedRoute roles={['super_admin', 'admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/employees" element={<ProtectedRoute roles={['super_admin', 'admin']}><Employees /></ProtectedRoute>} />
        <Route path="/admin/employees/new" element={<ProtectedRoute roles={['super_admin', 'admin']}><EmployeeForm /></ProtectedRoute>} />
        <Route path="/admin/employees/:id/edit" element={<ProtectedRoute roles={['super_admin', 'admin']}><EmployeeForm /></ProtectedRoute>} />
        <Route path="/admin/departments" element={<ProtectedRoute roles={['super_admin', 'admin']}><Departments /></ProtectedRoute>} />
        <Route path="/admin/designations" element={<ProtectedRoute roles={['super_admin', 'admin']}><Designations /></ProtectedRoute>} />
        <Route path="/admin/attendance" element={<ProtectedRoute roles={['super_admin', 'admin']}><AdminAttendance /></ProtectedRoute>} />
        <Route path="/admin/map" element={<ProtectedRoute roles={['super_admin', 'admin']}><LiveMap /></ProtectedRoute>} />
        <Route path="/admin/live" element={<ProtectedRoute roles={['super_admin', 'admin']}><LiveStatus /></ProtectedRoute>} />
        <Route path="/admin/holidays" element={<ProtectedRoute roles={['super_admin', 'admin']}><Holidays /></ProtectedRoute>} />
        <Route path="/admin/shifts" element={<ProtectedRoute roles={['super_admin', 'admin']}><Shifts /></ProtectedRoute>} />
        <Route path="/admin/clients" element={<ProtectedRoute roles={['super_admin', 'admin']}><Clients /></ProtectedRoute>} />
        <Route path="/admin/purchases" element={<ProtectedRoute roles={['super_admin', 'admin']}><Purchases /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute roles={['super_admin', 'admin']}><Reports /></ProtectedRoute>} />
        <Route path="/admin/security" element={<ProtectedRoute roles={['super_admin', 'admin']}><SecurityLogs /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute roles={['super_admin', 'admin']}><Settings /></ProtectedRoute>} />

        {/* Employee */}
        <Route path="/me" element={<EmployeeDashboard />} />
        <Route path="/me/attendance" element={<MarkAttendance />} />
        <Route path="/me/history" element={<AttendanceHistory />} />

        {/* Shared */}
        <Route path="/notice-board" element={<NoticeBoard />} />
        <Route path="/holidays" element={<HolidayList />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/help-desk" element={<Tickets />} />
        <Route path="/leaves" element={<Leaves />} />
        <Route path="/regularize" element={<Regularize />} />
        <Route path="/team" element={<MyTeam />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Public landing page */}
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
