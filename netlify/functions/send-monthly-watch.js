exports.handler = async () => {
  await fetch(`${process.env.VITE_APP_URL}/.netlify/functions/run-benefits-watch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': process.env.ADMIN_PASSWORD },
    body: JSON.stringify({ alertType: 'monthly_checkin' }),
  })
  return { statusCode: 200, body: 'Monthly watch sent' }
}
