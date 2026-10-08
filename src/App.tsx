import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  Bath,
  BedDouble,
  ChevronRight,
  Home,
  MapPin,
  Menu,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BackLink } from '@/components/ui/BackLink'
import {
  formatCurrency,
  formatDate,
  getErrorMessage,
  titleCase,
} from '@/lib/utils'
import { getMyProfile, signIn, signOut, signUp } from '@/services/auth'
import { createEnquiry } from '@/services/enquiries'
import {
  getFeaturedProperties,
  getPublicPropertyBySlug,
  searchPublicProperties,
} from '@/services/properties'
import { getPublicImageUrl } from '@/services/storage'
import { watchTableLabels } from '@/lib/tableLabels'
import { PropertyEditor } from '@/components/PropertyEditor'
import { PropertyCard } from '@/components/PropertyCard'
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget'
import { AgentsPage, EnquiriesPage } from '@/components/AdminOperations'
import {
  CustomersPage,
  FollowUpsPage,
  LeadsPage,
  NotificationsPage,
  SiteVisitsPage,
} from '@/components/CRMOperations'
import { LeadDetailPage } from '@/components/crm/LeadDetailPage'
import { CustomerDetailPage } from '@/components/crm/CustomerDetailPage'
import {
  NewPropertyPage,
  StaffPropertiesPage,
} from '@/components/property/StaffPropertiesPage'
import { getDashboardStats } from '@/services/dashboard'
import { listActivities } from '@/services/activities'
import type {
  Profile,
  PropertySearchItem,
  PropertyWithRelations,
} from '@/types/domain'
import { LISTING_TYPES, PROPERTY_TYPES } from '@/types/domain'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Site />
    </BrowserRouter>
  )
}
function Site() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch(() => null)
      .finally(() => setReady(true))
  }, [])
  if (!ready) return <div className="page-center">Loading Haven & Key…</div>
  // Wraps a CRM page: active staff only, optionally admin-only, in the shell.
  const staff = (
    render: (profile: Profile) => ReactNode,
    options: { adminOnly?: boolean } = {},
  ) => (
    <Protected profile={profile} adminOnly={options.adminOnly}>
      {profile && (
        <CRM profile={profile} onSignOut={() => setProfile(null)}>
          {render(profile)}
        </CRM>
      )}
    </Protected>
  )
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <Public>
              <HomePage />
            </Public>
          }
        />
        <Route
          path="/properties"
          element={
            <Public>
              <Listings />
            </Public>
          }
        />
        <Route
          path="/properties/:slug"
          element={
            <Public>
              <PropertyPage />
            </Public>
          }
        />
        <Route path="/login" element={<Login setProfile={setProfile} />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={staff(() => (
            <Dashboard />
          ))}
        />
        <Route
          path="/crm/properties"
          element={staff((p) => (
            <StaffPropertiesPage profile={p} />
          ))}
        />
        <Route
          path="/crm/properties/new"
          element={staff((p) => (
            <NewPropertyPage profile={p} />
          ))}
        />
        <Route
          path="/crm/properties/:id/edit"
          element={staff((p) => (
            <EditRoute profile={p} />
          ))}
        />
        <Route
          path="/crm/agents"
          element={staff(
            (p) => (
              <AgentsPage profile={p} />
            ),
            {
              adminOnly: true,
            },
          )}
        />
        <Route
          path="/crm/enquiries"
          element={staff(() => (
            <EnquiriesPage />
          ))}
        />
        <Route
          path="/crm/customers"
          element={staff((p) => (
            <CustomersPage profile={p} />
          ))}
        />
        <Route
          path="/crm/customers/:id"
          element={staff((p) => (
            <CustomerDetailPage profile={p} />
          ))}
        />
        <Route
          path="/crm/leads"
          element={staff((p) => (
            <LeadsPage profile={p} />
          ))}
        />
        <Route
          path="/crm/leads/:id"
          element={staff((p) => (
            <LeadDetailPage profile={p} />
          ))}
        />
        <Route
          path="/crm/follow-ups"
          element={staff((p) => (
            <FollowUpsPage profile={p} />
          ))}
        />
        <Route
          path="/crm/site-visits"
          element={staff((p) => (
            <SiteVisitsPage profile={p} />
          ))}
        />
        <Route
          path="/crm/notifications"
          element={staff((p) => (
            <NotificationsPage profile={p} />
          ))}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatbotWidget />
    </>
  )
}
function Public({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <>
      <header>
        <div className="container-app nav">
          <Link className="brand" to="/">
            <i>H</i> Haven & Key
          </Link>
          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav className={open ? 'menu-open' : ''}>
            <Link onClick={close} to="/properties">
              Browse homes
            </Link>
            <a onClick={close} href="/#about">
              Our approach
            </a>
            <Link onClick={close} className="login-link" to="/login">
              Login
            </Link>
            <Link onClick={close} className="outline-link" to="/signup">
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer>
        <div className="container-app footer">
          <div>
            <Link className="brand" to="/">
              <i>H</i> Haven & Key
            </Link>
            <p>Thoughtful real estate for the way you want to live.</p>
          </div>
          <p>© {new Date().getFullYear()} Haven & Key Real Estate</p>
        </div>
      </footer>
    </>
  )
}
function HomePage() {
  const [homes, setHomes] = useState<PropertySearchItem[]>([]),
    [error, setError] = useState('')
  useEffect(() => {
    getFeaturedProperties()
      .then(setHomes)
      .catch((e) => setError(getErrorMessage(e)))
  }, [])
  return (
    <main>
      <section className="hero">
        <div className="container-app hero-grid">
          <div>
            <p className="eyebrow">A better way to move</p>
            <h1>
              A home that feels <em>entirely yours.</em>
            </h1>
            <p className="lead">
              A considered collection of remarkable spaces, selected with care
              and matched with people who understand what home means.
            </p>
            <SearchBox />
            <p className="tiny">
              ✓ Verified listings &nbsp;&nbsp; · &nbsp;&nbsp; Local expertise
            </p>
          </div>
          <div className="hero-art">
            <span>
              Find your place
              <br />
              <em>in the world.</em>
            </span>
          </div>
        </div>
      </section>
      <section className="container-app section">
        <div className="heading">
          <div>
            <p className="eyebrow">Selected for you</p>
            <h2>Homes worth coming home to.</h2>
          </div>
          <Link to="/properties">
            Explore all <ChevronRight />
          </Link>
        </div>
        {error ? <Notice text={error} /> : <Cards items={homes} />}
      </section>
      <section id="about" className="approach">
        <div className="container-app approach-grid">
          <div>
            <p className="eyebrow">The Haven & Key way</p>
            <h2>
              Less searching.
              <br />
              More belonging.
            </h2>
          </div>
          <Step
            n="01"
            title="Tell us what matters"
            text="Share your lifestyle, wish list, and vision. We listen to the details."
          />
          <Step
            n="02"
            title="Discover with confidence"
            text="Thoughtful recommendations, straight answers, and guidance at every turn."
          />
          <Step
            n="03"
            title="Make it yours"
            text="From first viewing to keys in hand, the journey feels beautifully simple."
          />
        </div>
      </section>
      <section className="container-app cta">
        <div>
          <p className="eyebrow">Your next chapter starts here</p>
          <h2>
            Let’s find somewhere
            <br />
            <em>extraordinary.</em>
          </h2>
        </div>
        <Link to="/properties">
          <Button size="lg">
            Start your search <ChevronRight size={17} />
          </Button>
        </Link>
      </section>
    </main>
  )
}
function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="step">
      <b>{n}</b>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
function SearchBox() {
  const nav = useNavigate(),
    [city, setCity] = useState(''),
    [listing, setListing] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    nav(`/properties?city=${encodeURIComponent(city)}&listing=${listing}`)
  }
  return (
    <form className="searchbox" onSubmit={submit}>
      <label>
        <small>Looking for</small>
        <select value={listing} onChange={(e) => setListing(e.target.value)}>
          <option value="">Any listing</option>
          {LISTING_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <small>Location</small>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City or neighbourhood"
        />
      </label>
      <Button type="submit" leftIcon={<Search size={16} />}>
        Search homes
      </Button>
    </form>
  )
}
function Listings() {
  const [p, setP] = useSearchParams(),
    [items, setItems] = useState<PropertySearchItem[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [totalPages, setTotalPages] = useState(1)
  const [query, setQuery] = useState(p.get('query') || ''),
    [city, setCity] = useState(p.get('city') || ''),
    [type, setType] = useState(p.get('type') || ''),
    [listing, setListing] = useState(p.get('listing') || ''),
    page = Number(p.get('page') || 1)
  useEffect(() => {
    setLoading(true)
    searchPublicProperties({
      query: p.get('query') || undefined,
      city: p.get('city') || undefined,
      propertyType: (p.get('type') || undefined) as never,
      listingType: (p.get('listing') || undefined) as never,
      page,
      pageSize: 12,
    })
      .then((x) => {
        setItems(x.data)
        setTotalPages(x.totalPages)
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [p, page])
  function submit(e: FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams()
    if (query) next.set('query', query)
    if (city) next.set('city', city)
    if (type) next.set('type', type)
    if (listing) next.set('listing', listing)
    setP(next)
  }
  function go(nextPage: number) {
    const next = new URLSearchParams(p)
    next.set('page', String(nextPage))
    setP(next)
  }
  return (
    <main className="container-app listings">
      <p className="eyebrow">Available homes</p>
      <h1>Find a place to belong.</h1>
      <form className="filters" onSubmit={submit}>
        <input
          placeholder="Search homes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All home types</option>
          {PROPERTY_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <select value={listing} onChange={(e) => setListing(e.target.value)}>
          <option value="">Buy or rent</option>
          {LISTING_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <Button type="submit">Apply filters</Button>
      </form>
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice text={error} />
      ) : items.length ? (
        <>
          <Cards items={items} />
          {totalPages > 1 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => go(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => go(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <Empty title="No homes match those filters" />
      )}
    </main>
  )
}
function Cards({ items }: { items: PropertySearchItem[] }) {
  return (
    <div className="cards">
      {items.map((p) => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </div>
  )
}
function PropertyPage() {
  const { slug = '' } = useParams(),
    [property, setProperty] = useState<PropertyWithRelations | null>(null),
    [error, setError] = useState(''),
    [sent, setSent] = useState(false),
    [sending, setSending] = useState(false)
  useEffect(() => {
    getPublicPropertyBySlug(slug)
      .then(setProperty)
      .catch((e) => setError(getErrorMessage(e)))
  }, [slug])
  if (error)
    return (
      <main className="container-app detail">
        <BackLink fallback="/properties" fallbackLabel="All homes" />
        <Empty title={error} />
      </main>
    )
  if (!property) return <Loading />
  const current = property,
    images = current.property_images
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setSending(true)
    createEnquiry({
      property_id: current.id,
      name: String(f.get('name')),
      email: String(f.get('email')),
      phone: String(f.get('phone') || ''),
      message: String(f.get('message')),
    })
      .then(() => setSent(true))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setSending(false))
  }
  return (
    <main className="container-app detail">
      <BackLink fallback="/properties" fallbackLabel="All homes" />
      <div className="gallery">
        {images.length ? (
          images
            .slice(0, 5)
            .map((x, i) => (
              <img
                key={x.id}
                className={i === 0 ? 'main-image' : ''}
                src={getPublicImageUrl(x.storage_path) || ''}
                alt={x.alt_text || current.title}
              />
            ))
        ) : (
          <div className="fallback">
            <Home />
          </div>
        )}
      </div>
      <div className="detail-grid">
        <article>
          <p className="kind">
            {titleCase(current.property_type)} ·{' '}
            {current.listing_type === 'sale' ? 'For sale' : 'For rent'}
          </p>
          <h1>{current.title}</h1>
          <strong className="price">
            {formatCurrency(current.price, current.currency)}
          </strong>
          <p className="location">
            <MapPin /> {current.address_line_1}, {current.city},{' '}
            {current.region}
          </p>
          <div className="stats">
            <span>
              <BedDouble /> {current.bedrooms} bedrooms
            </span>
            <span>
              <Bath /> {current.bathrooms} bathrooms
            </span>
            <span>{current.floor_area || '—'} sq ft</span>
            {current.parking_spaces > 0 && (
              <span>{current.parking_spaces} parking</span>
            )}
            {current.year_built && <span>Built {current.year_built}</span>}
          </div>
          {current.excerpt && <p className="lead">{current.excerpt}</p>}
          <h2>About this home</h2>
          <p className="description">{current.description}</p>
          {current.amenities.length > 0 && (
            <>
              <h2>Amenities</h2>
              <ul className="amenities">
                {current.amenities.map((amenity) => (
                  <li key={amenity}>{amenity}</li>
                ))}
              </ul>
            </>
          )}
        </article>
        <aside className="contact-card">
          {sent ? (
            <div className="success">
              <h2>Message sent.</h2>
              <p>Thank you — a property advisor will be in touch shortly.</p>
            </div>
          ) : (
            <>
              <p className="eyebrow">Interested?</p>
              <h2>Arrange a viewing</h2>
              <p>Speak with a local advisor about this home.</p>
              <form onSubmit={submit}>
                <input required name="name" placeholder="Your name" />
                <input
                  required
                  name="email"
                  type="email"
                  placeholder="Email address"
                />
                <input name="phone" placeholder="Phone number" />
                <textarea
                  required
                  name="message"
                  defaultValue={`I'm interested in ${current.title}.`}
                />
                {error && <p className="error">{error}</p>}
                <Button loading={sending} className="full">
                  Send enquiry
                </Button>
              </form>
            </>
          )}
        </aside>
      </div>
    </main>
  )
}
function Login({ setProfile }: { setProfile: (p: Profile) => void }) {
  const nav = useNavigate(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false)
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setLoading(true)
    signIn(String(f.get('email')), String(f.get('password')))
      .then(getMyProfile)
      .then(async (p) => {
        if (!p) throw Error('Your account has no staff profile.')
        if (!p.active) {
          await signOut()
          throw Error(
            'Your account is waiting for an administrator to approve it. You can sign in once it has been activated.',
          )
        }
        setProfile(p)
        nav('/dashboard')
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }
  return (
    <main className="login">
      <Link className="brand" to="/">
        <i>H</i> Haven & Key
      </Link>
      <form onSubmit={submit}>
        <BackLink fallback="/" fallbackLabel="Back to website" />
        <p className="eyebrow">For the team</p>
        <h1>Welcome back.</h1>
        <p>Sign in to manage listings and enquiries.</p>
        <input required name="email" type="email" placeholder="Email address" />
        <input
          required
          name="password"
          type="password"
          placeholder="Password"
        />
        {error && <p className="error">{error}</p>}
        <Button type="submit" loading={loading} className="full">
          Sign in
        </Button>
        <p>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </main>
  )
}
function Signup() {
  const nav = useNavigate(),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false),
    [loading, setLoading] = useState(false)
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget),
      password = String(f.get('password'))
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== String(f.get('confirm_password'))) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    signUp(String(f.get('full_name')), String(f.get('email')), password)
      .then(() => {
        setSuccess(true)
        setTimeout(() => nav('/login'), 3500)
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }
  return (
    <main className="login">
      <Link className="brand" to="/">
        <i>H</i> Haven & Key
      </Link>
      <form onSubmit={submit}>
        <BackLink fallback="/" fallbackLabel="Back to website" />
        <p className="eyebrow">Join the team</p>
        <h1>Create account.</h1>
        <p>
          {success
            ? 'Account created. An administrator needs to approve it before you can sign in.'
            : 'Staff accounts are activated by an administrator after sign-up.'}
        </p>
        {!success && (
          <>
            <input required name="full_name" placeholder="Full name" />
            <input
              required
              name="email"
              type="email"
              placeholder="Email address"
            />
            <input
              required
              name="password"
              type="password"
              minLength={8}
              placeholder="Password (minimum 8 characters)"
            />
            <input
              required
              name="confirm_password"
              type="password"
              minLength={8}
              placeholder="Confirm password"
            />
            {error && <p className="error">{error}</p>}
            <Button type="submit" loading={loading} className="full">
              Create account
            </Button>
            <p>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </form>
    </main>
  )
}
function Protected({
  profile,
  adminOnly = false,
  children,
}: {
  profile: Profile | null
  adminOnly?: boolean
  children: ReactNode
}) {
  if (!profile?.active) return <Navigate to="/login" replace />
  if (adminOnly && profile.role !== 'admin')
    return <Navigate to="/dashboard" replace />
  return children
}
const CRM_LINKS: Array<{
  to: string
  label: string
  short?: string
  adminOnly?: boolean
  end?: boolean
}> = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/crm/leads', label: 'Leads' },
  { to: '/crm/customers', label: 'Customers' },
  { to: '/crm/follow-ups', label: 'Follow-ups', short: 'Tasks' },
  { to: '/crm/site-visits', label: 'Site visits', short: 'Visits' },
  { to: '/crm/notifications', label: 'Notifications', short: 'Inbox' },
  { to: '/crm/properties', label: 'Properties', end: true },
  { to: '/crm/properties/new', label: 'Add listing' },
  { to: '/crm/enquiries', label: 'Enquiries' },
  { to: '/crm/agents', label: 'Agents', adminOnly: true },
]
function CRM({
  profile,
  onSignOut,
  children,
}: {
  profile: Profile
  onSignOut: () => void
  children: ReactNode
}) {
  const nav = useNavigate()
  const content = useRef<HTMLElement>(null)
  // Column labels for the stacked phone layout of every CRM table.
  useEffect(() => {
    if (content.current) return watchTableLabels(content.current)
  }, [])
  const links = CRM_LINKS.filter(
    (link) => !link.adminOnly || profile.role === 'admin',
  )
  const logout = () =>
    signOut().then(() => {
      onSignOut()
      nav('/login')
    })
  return (
    <div className="crm">
      <aside>
        <Link className="brand" to="/">
          <i>H</i> Haven & Key
        </Link>
        <small>WORKSPACE</small>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end}>
            {link.label}
          </NavLink>
        ))}
        <button onClick={logout}>Sign out</button>
        <p>
          {profile.full_name}
          <small>{profile.role}</small>
        </p>
      </aside>
      <div className="crm-mobile-nav">
        <Link className="brand" to="/">
          <i>H</i> H&K
        </Link>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end}>
            {link.short ?? link.label}
          </NavLink>
        ))}
        <button onClick={logout}>Logout</button>
      </div>
      <section ref={content}>{children}</section>
    </div>
  )
}
function Dashboard() {
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDashboardStats>
  > | null>(null)
  const [activity, setActivity] = useState<
    Awaited<ReturnType<typeof listActivities>>
  >([])
  useEffect(() => {
    Promise.all([getDashboardStats(), listActivities({ limit: 6 })])
      .then(([metrics, recentActivity]) => {
        setStats(metrics)
        setActivity(recentActivity)
      })
      .catch(() => {
        setStats(null)
        setActivity([])
      })
  }, [])
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Good morning.</h1>
        </div>
        <Link to="/crm/properties/new">
          <Button>Add property</Button>
        </Link>
      </div>
      <div className="stat-grid">
        <Stat
          title="All properties"
          value={String(stats?.totalProperties ?? '—')}
        />
        <Stat
          title="Published"
          value={String(stats?.publishedProperties ?? '—')}
        />
        <Stat title="Customers" value={String(stats?.totalCustomers ?? '—')} />
        <Stat title="Total leads" value={String(stats?.totalLeads ?? '—')} />
        <Stat title="New leads" value={String(stats?.newLeads ?? '—')} />
        <Stat
          title="Qualified leads"
          value={String(stats?.qualifiedLeads ?? '—')}
        />
        <Stat
          title="Pending follow-ups"
          value={String(stats?.pendingFollowUps ?? '—')}
        />
        <Stat
          title="Upcoming visits"
          value={String(stats?.upcomingSiteVisits ?? '—')}
        />
        <Stat
          title="Follow-ups due today"
          value={String(stats?.todayFollowUps ?? '—')}
          to="/crm/follow-ups?view=today"
        />
        <Stat
          title="Overdue follow-ups"
          value={String(stats?.overdueFollowUps ?? '—')}
          to="/crm/follow-ups?view=overdue"
        />
        <Stat
          title="Converted leads"
          value={String(stats?.convertedLeads ?? '—')}
          to="/crm/leads?status=converted"
        />
        <Stat
          title="Draft listings"
          value={String(stats?.draftProperties ?? '—')}
          to="/crm/properties?status=draft"
        />
      </div>
      <div className="panel-stack">
        <div className="panel">
          <h2>Recent activity</h2>
          {activity.length ? (
            <ul className="activity-list">
              {activity.map((event) => (
                <li key={event.id}>
                  <strong>{event.action.replaceAll('_', ' ')}</strong>
                  <span>{event.description}</span>
                  <small>{formatDate(event.created_at)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="table-empty">No recent activity yet.</p>
          )}
        </div>
      </div>
    </>
  )
}
function Stat({
  title,
  value,
  to,
}: {
  title: string
  value: string
  to?: string
}) {
  const body = (
    <>
      <p>{title}</p>
      <strong>{value}</strong>
    </>
  )
  return to ? (
    <Link className="stat stat-link" to={to}>
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  )
}
function EditRoute({ profile }: { profile: Profile }) {
  const { id } = useParams()
  return id ? (
    <PropertyEditor id={id} profile={profile} />
  ) : (
    <Empty title="Property not found" />
  )
}
function Loading() {
  return <div className="loading">Loading…</div>
}
function Notice({ text }: { text: string }) {
  return <div className="notice">{text}</div>
}
function Empty({ title }: { title: string }) {
  return (
    <div className="empty">
      <Home />
      <h2>{title}</h2>
      <p>Try adjusting your search or check back soon.</p>
    </div>
  )
}
