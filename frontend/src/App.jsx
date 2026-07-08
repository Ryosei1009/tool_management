import { useState } from 'react'
import Footer from './components/Util/Footer'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ToolList from './components/ToolList/ToolList'
import RentList from './components/RentList/RentList'
import Rent from './components/Rent/Rent'
import MyPage from './components/MyPage/MyPage'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <BrowserRouter>
        <main>
          <Routes>
            <Route path="/rent" element={<Rent />} />
            <Route path="/rentlist" element={<RentList />} />
            <Route path="/tools" element={<ToolList />} />
            <Route path="/mypage" element={<MyPage />} />
          </Routes>
          <Footer />
        </main>
      </BrowserRouter>
    </>
  )
}

export default App
