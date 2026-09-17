import { Link } from 'react-router-dom'
import { logo } from '../assets'

export default function Brand({ compact = false }) {
  return (
    <Link className="brand" to="/" aria-label="AAIR Lab - Trang chủ">
      <span className="brand__mark">
        <img src={logo} alt="" />
      </span>
      {!compact && (
        <span>
          <strong>AAIR Lab</strong>
          <small>Applied AI Research</small>
        </span>
      )}
    </Link>
  )
}
