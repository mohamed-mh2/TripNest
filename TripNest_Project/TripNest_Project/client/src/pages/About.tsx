import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/SiteLayout';
import TravelPhoto from '../components/TravelPhoto';
import '../Discover.css';

const team = [
  [
    'MA',
    'Madin Abed',
    'Accounts & personal trips',
    'A place to sign in, save your adventures and manage each trip.',
  ],
  [
    'AA',
    'Abed Alrahman',
    'Travel services & bookings',
    'Service discovery, booking details and the demo checkout journey.',
  ],
  [
    'MM',
    'Mohamed Mhamed',
    'Planning & travel funds',
    'Cost estimates, the assistant, simulated wallet, support and cash packages.',
  ],
  [
    'MF',
    'Mohamed Fody',
    'Readiness & help center',
    'Travel preparation, readiness checklists and support requests.',
  ],
];

export default function About() {
  return (
    <div className="discovery-site">
      <SiteHeader />
      <main id="main-content" className="discovery-main about-main" tabIndex={-1}>
        <section className="about-intro">
          <div>
            <span className="discovery-kicker">THE IDEA BEHIND TRIPNEST</span>
            <h1>
              Travel is exciting.
              <br />
              <em>
                The admin?
                <br />
                Not so much.
              </em>
            </h1>
            <p>
              We’re four students building a simpler way to bring the pieces of a trip
              together. Less searching for what you saved. More looking forward to where
              you’re going.
            </p>
            <Link className="site-button" to="/trips">
              Make space for your next trip ↗
            </Link>
          </div>
          <div className="about-photo">
            <TravelPhoto
              name="barcelona"
              alt="An evening view across Barcelona rooftops"
              priority
            />
            <span>One destination. So many moving parts.</span>
          </div>
        </section>

        <section className="discovery-section">
          <span className="discovery-kicker">THE PROBLEM</span>
          <h2>
            Great trips shouldn’t
            <br />
            <em>take ten different tabs.</em>
          </h2>
          <div className="problem-grid">
            {[
              [
                '01',
                'Plans scattered everywhere',
                'A booking in one place, an eSIM in another, and your travel notes somewhere else.',
              ],
              [
                '02',
                'Costs that are hard to see',
                'Transport, stays, food and activities add up. A booking total alone doesn’t explain the whole trip.',
              ],
              [
                '03',
                'Help without a clear path',
                'When you need backup, it should be easy to find your trip, ask for help and understand the next step.',
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-solution">
          <span className="discovery-kicker">OUR APPROACH</span>
          <h2>
            One connected workspace.
            <br />
            <em>For the whole journey.</em>
          </h2>
          <p>
            Start with a personal trip. Its destination, dates and travelers give your
            other tools context. Service bookings inform the cost planner, while wallet
            activity, readiness and help requests stay easy to reach.
          </p>
          <div className="solution-path">
            <Link to="/trips">Your trip ↗</Link>
            <Link to="/services">Your bookings ↗</Link>
            <Link to="/#planner">Your estimates ↗</Link>
            <Link to="/readiness">Your preparation ↗</Link>
          </div>
          <p className="solution-note">
            Planning money and spending money are different. TripNest keeps an estimated
            budget separate from the simulated wallet balance.
          </p>
        </section>

        <section className="discovery-section">
          <div className="discovery-section-heading">
            <div>
              <span className="discovery-kicker">FOUR PEOPLE. ONE SHARED IDEA.</span>
              <h2>
                Meet the team
                <br />
                <em>behind the journey.</em>
              </h2>
            </div>
            <p>
              Each person owns a part of TripNest. Together, we connected those parts into
              one customer experience.
            </p>
          </div>
          <div className="team-grid">
            {team.map(([initials, name, role, text]) => (
              <article key={name}>
                <span className="team-avatar" aria-hidden="true">
                  {initials}
                </span>
                <h3>{name}</h3>
                <strong>{role}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="prototype-section">
          <div>
            <span className="discovery-kicker">HONEST ABOUT WHERE WE ARE</span>
            <h2>
              A working student prototype.
              <br />
              <em>A bigger idea for tomorrow.</em>
            </h2>
          </div>
          <div>
            <h3>What you can try today</h3>
            <p>
              Accounts and saved trips, a demonstration travel catalog, simulated bookings
              and checkout, trip estimates, a cost assistant, wallet records, cash-package
              codes, travel support, readiness and help requests.
            </p>
            <h3>What comes later</h3>
            <p>
              Live travel-provider connections, real bank-issued cards, payment
              processing, currency exchange and authorized cash-collection partners
              require separate integrations and implementation. Arabic across the website
              is also planned.
            </p>
            <p className="prototype-note">
              The cost assistant uses estimation rules and ranges, not live provider
              quotes or a connected generative AI service. Bookings, payments and cash
              collection are simulated.
            </p>
          </div>
        </section>

        <section className="photo-credits" aria-labelledby="photo-credits-title">
          <h2 id="photo-credits-title">A little credit for the view.</h2>
          <p>
            Real photographs, served as optimized local assets under the{' '}
            <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">
              Unsplash License
            </a>
            .
          </p>
          <ul>
            <li>
              <a
                href="https://unsplash.com/photos/a-view-of-a-mountain-range-with-a-lake-in-the-foreground-ok1KivJHzB4"
                target="_blank"
                rel="noreferrer"
              >
                Lake Como — Lisha Riabinina
              </a>
            </li>
            <li>
              <a
                href="https://unsplash.com/photos/city-buildings-are-bathed-in-warm-sunlight-FyJWRub_o9E"
                target="_blank"
                rel="noreferrer"
              >
                Barcelona — Yevhenii Dubrovskyi
              </a>
            </li>
            <li>
              <a
                href="https://unsplash.com/photos/swimming-pool-near-palm-trees-during-daytime-D1yT791Nf9A"
                target="_blank"
                rel="noreferrer"
              >
                Mission Bay Resort — Cory Bjork
              </a>
            </li>
          </ul>
          <p>
            Inspiration photos do not represent the simulated providers in our catalog.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
