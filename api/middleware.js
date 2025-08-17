export default function handler(req, res) {
  const { store } = req.query;
  return res.redirect(`/stores/${store}/index.html`);
}
