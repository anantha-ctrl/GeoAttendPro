import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Guards a route. If `roles` is provided, the user must hold one of them.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={['super_admin', 'admin'].includes(user.role) ? '/admin' : '/me'} replace />;
  }
  return children;
}
