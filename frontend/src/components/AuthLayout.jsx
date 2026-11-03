export default function AuthLayout({ children }) {
  return <div className="auth-layout"><aside className="auth-intro"><span className="eyebrow">Handmade, thoughtfully chosen</span><h1>A home for<br />handmade.</h1><p>Meet independent makers, discover something personal, and connect over work made with care.</p><p className="intro-note">Buyer: discover and request.<br />Seller: share and manage your craft.</p></aside><section className="auth-card">{children}</section></div>;
}
