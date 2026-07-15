import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const Footer = () => {
    const location = useLocation()

    // すでに同じページにいる場合はページ遷移せずリロードする
    const handleClick = (to) => (e) => {
        if (location.pathname === to) {
            e.preventDefault()
            window.location.reload()
        }
    }

    const items = [
        { to: '/rent', img: '/img/footer/rent.png', alt: 'Rent' },
        { to: '/rentlist', img: '/img/footer/rentlist.png', alt: 'Rent List' },
        { to: '/tools', img: '/img/footer/tools.png', alt: 'Tools' },
        { to: '/mypage', img: '/img/footer/mypage.png', alt: 'MyPage' },
    ]

    return (
        <header className="w-screen h-24 fixed bottom-0 left-0 bg-main flex justify-around items-center">
            {items.map(({ to, img, alt }) => (
                <Link
                    key={to}
                    to={to}
                    onClick={handleClick(to)}
                    className="w-1/4 flex justify-center items-center"
                >
                    <img src={img} alt={alt} className="w-14 h-14 invert" />
                </Link>
            ))}
        </header>
    )
}

export default Footer
