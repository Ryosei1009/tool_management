import React from 'react'
import { Link } from 'react-router-dom'

const Footer = () => {
    return (
        <header className="w-screen h-24 fixed bottom-0 left-0 bg-sub flex justify-around items-center">
            <Link to="/rent" className="w-1/4 flex justify-center items-center">
                <img src="/img/footer/rent.png" alt="Rent" className="w-14 h-14 invert" />
            </Link>
            <Link to="/rentlist" className="w-1/4 flex justify-center items-center">
                <img src="/img/footer/rentlist.png" alt="Rent List" className="w-14 h-14 invert" />
            </Link>
            <Link to="/tools" className="w-1/4 flex justify-center items-center">
                <img src="/img/footer/tools.png" alt="Tools" className="w-14 h-14 invert" />
            </Link>
            <Link to="/mypage" className="w-1/4 flex justify-center items-center">
                <img src="/img/footer/mypage.png" alt="MyPage" className="w-14 h-14 invert" />
            </Link>
        </header>
    )
}

export default Footer