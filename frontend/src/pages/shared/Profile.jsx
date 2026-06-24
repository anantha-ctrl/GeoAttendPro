import { useEffect, useState } from 'react';
import api, { apiError, API_BASE } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate } from '../../utils/format.js';
import PasswordInput from '../../components/PasswordInput.jsx';
import FaceEnroll from '../../components/FaceEnroll.jsx';

export default function Profile() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' });
  const [photo, setPhoto] = useState(null);
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get('/profile').then((r) => {
    setProfile(r.data.data);
    setForm({ full_name: r.data.data.full_name || '', phone: r.data.data.phone || '', address: r.data.data.address || '' });
  });
  useEffect(() => { load(); }, []);

  const onPhoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const payload = { ...form };
      if (photo) payload.profile_photo = photo;
      await api.put('/profile', payload);
      setMsg('Profile updated.');
      setPhoto(null);
      await refresh();
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      await api.post('/auth/change-password', pw);
      setMsg('Password changed.');
      setPw({ current_password: '', password: '', password_confirmation: '' });
    } catch (err) { setError(apiError(err)); }
  };

  if (!profile) return <div className="spinner-border text-primary" />;

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">My Profile</h4><div className="sub">Your account &amp; security</div></div>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card stat-card text-center"><div className="card-body">
            <img
              src={photo || (profile.profile_photo ? `${API_BASE}${profile.profile_photo}` : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.full_name))}
              alt="avatar" className="rounded-circle mb-2" style={{ width: 110, height: 110, objectFit: 'cover' }} />
            <h5 className="mb-0">{profile.full_name}</h5>
            <div className="text-muted small">{profile.role_name}</div>
            <hr />
            <div className="text-start small">
              <div><b>Employee ID:</b> {profile.employee_code}</div>
              <div><b>Email:</b> {profile.email}</div>
              <div><b>Department:</b> {profile.department_name || '—'}</div>
              <div><b>Designation:</b> {profile.designation_name || '—'}</div>
              <div><b>Joined:</b> {fmtDate(profile.joining_date)}</div>
            </div>
          </div></div>

          <div className="mt-3">
            <FaceEnroll
              enrolled={profile.face_enrolled}
              onChange={(v) => setProfile((p) => ({ ...p, face_enrolled: v }))} />
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card stat-card mb-3"><div className="card-body">
            <h6 className="fw-semibold">Edit Profile</h6>
            <form onSubmit={saveProfile} className="row g-2">
              <div className="col-md-6"><label className="form-label small">Full Name</label>
                <input className="form-control" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="col-md-6"><label className="form-label small">Phone</label>
                <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-12"><label className="form-label small">Address</label>
                <textarea className="form-control" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="col-12"><label className="form-label small">Profile Photo</label>
                <input type="file" accept="image/*" className="form-control" onChange={(e) => onPhoto(e.target.files[0])} /></div>
              <div className="col-12"><button className="btn btn-gap">Save Profile</button></div>
            </form>
          </div></div>

          <div className="card stat-card"><div className="card-body">
            <h6 className="fw-semibold">Change Password</h6>
            <form onSubmit={changePw} className="row g-2">
              <div className="col-md-4"><label className="form-label small">Current</label>
                <PasswordInput value={pw.current_password} required
                  onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></div>
              <div className="col-md-4"><label className="form-label small">New</label>
                <PasswordInput value={pw.password} required minLength={8}
                  onChange={(e) => setPw({ ...pw, password: e.target.value })} /></div>
              <div className="col-md-4"><label className="form-label small">Confirm</label>
                <PasswordInput value={pw.password_confirmation} required
                  onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} /></div>
              <div className="col-12"><button className="btn btn-outline-primary">Update Password</button></div>
            </form>
          </div></div>
        </div>
      </div>
    </>
  );
}
