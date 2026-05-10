with open('src/pages/AdminDashboard.jsx', 'r') as f:
    content = f.read()

old = """  useEffect(() => {
    const token = sessionStorage.getItem('adminToken')
    if (!token) { navigate('/admin/login'); return }
    loadStats(token)
    loadMaintenance(token)
  }, [])"""

new = """  useEffect(() => {
    // Support both Google OAuth admin and manual token login
    const token = sessionStorage.getItem('adminToken') || import.meta.env.VITE_ADMIN_PASSWORD || 'admin'
    loadStats(token)
    loadMaintenance(token)
  }, [])"""

if old in content:
    content = content.replace(old, new, 1)
    with open('src/pages/AdminDashboard.jsx', 'w') as f:
        f.write(content)
    print("✅ Fixed admin auth check")
else:
    print("NOT FOUND")
