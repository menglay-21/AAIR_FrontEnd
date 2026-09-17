import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn bạn vừa mở không tồn tại trong ứng dụng AAIR.</p>
      <Link className="button" to="/">Quay về trang chủ</Link>
    </main>
  )
}
