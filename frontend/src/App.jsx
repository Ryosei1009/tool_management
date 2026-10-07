import Footer from './components/Util/Footer'
import Header from './components/Util/Header'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ToolList from './components/ToolList/ToolList'
import RentList from './components/RentList/RentList'
import Rent from './components/Rent/Rent'
import MyPage from './components/MyPage/MyPage'
import NewTool from './components/NewTool/NewTool'
import EmployeeList from './components/EmployeeList/EmployeeList'
import InspectionItems from './components/InspectionItems/InspectionItems'
import AuthProvider from './auth/AuthProvider'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* 起動時に自動ログインし、トークンが揃ってから各画面を描画する */}
      <AuthProvider>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/tools" replace />} />
            <Route path="/rent" element={<Rent />} />
            <Route path="/rentlist" element={<RentList />} />
            <Route path="/tools" element={<ToolList />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/newtool" element={<NewTool />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/inspection-items" element={<InspectionItems />} />
          </Routes>
          <Footer />
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
