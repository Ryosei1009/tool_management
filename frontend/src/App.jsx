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
import Dashboard from './components/Dashboard/Dashboard'
import CsvPage from './components/Csv/CsvPage'
import MapSettings from './components/MapSettings/MapSettings'
import NoticeBar from './components/Util/NoticeBar'
import Help from './components/Help/Help'
import AuthProvider from './auth/AuthProvider'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* 起動時に自動ログインし、トークンが揃ってから各画面を描画する */}
      <AuthProvider>
        <Header />
        <main>
          {/* オフラインの表示と、返却遅れ・点検期限などのお知らせ */}
          <NoticeBar />
          <Routes>
            <Route path="/" element={<Navigate to="/tools" replace />} />
            <Route path="/rent" element={<Rent />} />
            <Route path="/rentlist" element={<RentList />} />
            <Route path="/tools" element={<ToolList />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/newtool" element={<NewTool />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/inspection-items" element={<InspectionItems />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/csv" element={<CsvPage />} />
            <Route path="/map-settings" element={<MapSettings />} />
            <Route path="/help" element={<Help />} />
          </Routes>
          <Footer />
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
