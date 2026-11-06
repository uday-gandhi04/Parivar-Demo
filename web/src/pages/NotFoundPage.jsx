import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="py-5 text-center">
      <div className="fw-medium">Page not found</div>
      <Link to="/" className="small d-inline-block mt-2 text-decoration-none text-primary">
        Back home
      </Link>
    </div>
  );
}
