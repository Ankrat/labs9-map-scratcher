import Link from 'next/link'

import Settings from '../components/Settings/Settings.js'

export default () => (
  <div>
    <p>
      <Link href="/">
        <a>Home </a>
      </Link>
      >
      <Link href="/settings">
        <a> Settings</a>
      </Link>
    </p>
    <Settings />
  </div>
)
