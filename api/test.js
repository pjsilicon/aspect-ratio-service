export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Aspect Ratio Service is alive!',
    timestamp: new Date().toISOString()
  });
}