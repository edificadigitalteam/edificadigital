import ProductLandingPage from './features/platform/ProductLandingPage.jsx'
import InKindDonationFlow from './features/in-kind/InKindDonationFlow.jsx'
import MonetaryDonationFlow from './features/monetary/MonetaryDonationFlow.jsx'

function App() {
  if (window.location.pathname.startsWith('/donations/in-kind')) {
    return <InKindDonationFlow />
  }

  if (window.location.pathname.startsWith('/donations/monetary')) {
    return <MonetaryDonationFlow />
  }

  return <ProductLandingPage />
}

export default App
