import { Link } from 'react-router-dom';
import TravelPhoto from '../components/TravelPhoto';
import { SiteHeader, SiteFooter } from '../components/SiteLayout';
import '../Discover.css';
import { useRef } from 'react';
import { useScrollStory } from '../features/useScrollStory';
import JourneyBackdrop from '../components/JourneyBackdrop';

const features = [
  {
    icon: '◌',
    title: 'A space for every trip',
    text: 'Save your destination, dates and travel companions. Keep each adventure separate.',
    path: '/trips',
    label: 'Start planning',
  },
  {
    icon: '✈',
    title: 'From takeoff to check-in',
    text: 'Explore flights, trains, ferries, hotels, eSIMs, local transport and experiences.',
    path: '/services',
    label: 'Explore services',
  },
  {
    icon: '◈',
    title: 'Know what it could cost',
    text: 'Estimate expenses, explore cost ranges with the assistant and leave room for a buffer.',
    path: '/#planner',
    label: 'Meet your cost planner',
  },
  {
    icon: '▤',
    title: 'Your wallet, made clear',
    text: 'Review simulated credit, demo payments and activity. Your planned budget stays separate.',
    path: '/#wallet',
    label: 'Open demo wallet',
  },
  {
    icon: '↗',
    title: 'A little help goes a long way',
    text: 'Request support from anyone you trust, or redeem a package code sent to you.',
    path: '/#funds',
    label: 'Explore travel funds',
  },
  {
    icon: '☑',
    title: 'Ready for what’s next',
    text: 'Check your travel essentials and keep help requests together when plans change.',
    path: '/readiness',
    label: 'Check trip readiness',
  },
];

export default function Home() {
  const story = useRef<HTMLDivElement>(null);
  useScrollStory(story);
  return (
    <div className="discovery-site home-road-site" ref={story}>
      <JourneyBackdrop page={story} />
      <div className="scroll-progress" aria-hidden="true">
        <span />
      </div>
      <SiteHeader />
      {new URLSearchParams(location.search).has('signedOut') && (
        <p className="site-signed-out" role="status">
          You’re signed out. Your saved trips are ready when you log in again.
        </p>
      )}
      <main id="main-content" className="discovery-main" tabIndex={-1}>
        <section className="discovery-hero">
          <TravelPhoto
            name="lake-como"
            alt="Warm evening light over Lake Como and the surrounding Italian mountains"
            priority
          />
          <div className="discovery-hero-shade" />
          <div className="discovery-hero-copy">
            <span className="discovery-kicker">
              <span aria-hidden="true">✦</span> BIG DREAMS. A LITTLE LESS PLANNING.
            </span>
            <h1>
              Go somewhere
              <br />
              <em>you’ll remember.</em>
            </h1>
            <p>
              One place for your plans, bookings, travel funds and all the little things
              in between. Meet your next travel companion.
            </p>
            <div className="discovery-actions">
              <Link className="site-button site-button--sun" to="/trips">
                Plan your trip <span aria-hidden="true">↗</span>
              </Link>
              <Link className="site-button site-button--glass" to="/services">
                Explore travel services
              </Link>
            </div>
            <span className="hero-location">
              ↳ Lake Como, Italy · A little inspiration for your next chapter
            </span>
            <a className="hero-scroll-cue" href="#possibilities">
              Scroll into the journey <span aria-hidden="true">↓</span>
            </a>
          </div>
          <Link to="/#planner" className="hero-trip-note">
            <span className="note-top">
              A LITTLE PLANNING GOES A LONG WAY <span aria-hidden="true">↗</span>
            </span>
            <strong>
              Dream it.
              <br />
              Make room for it.
            </strong>
            <span>Estimate first. Explore with confidence.</span>
          </Link>
        </section>

        <div className="discovery-ribbon" aria-label="Your connected travel workspace">
          <span>EVERY PART OF THE JOURNEY</span>
          <b>Plan</b>
          <i>↗</i>
          <b>Book</b>
          <i>↗</i>
          <b>Prepare</b>
          <i>↗</i>
          <b>Travel</b>
          <small>A student-built travel prototype</small>
        </div>

        <section className="discovery-section" id="possibilities">
          <div className="discovery-section-heading" data-reveal>
            <div>
              <span className="discovery-kicker">LESS ADMIN. MORE ADVENTURE.</span>
              <h2>
                All the pieces.
                <br />
                <em>One happy journey.</em>
              </h2>
            </div>
            <p>
              Your travel plans shouldn’t live in ten different tabs. Bring the essentials
              together, from your first idea to your last check-in.
            </p>
          </div>
          <div className="discovery-feature-grid">
            {features.map((feature) => (
              <Link
                to={feature.path}
                className="discovery-feature"
                key={feature.title}
                data-reveal
              >
                <span className="feature-symbol" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <span className="feature-link">
                  {feature.label}
                  <span aria-hidden="true">↗</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="discovery-section inspiration-section">
          <div className="discovery-section-heading" data-reveal>
            <div>
              <span className="discovery-kicker">MAKE ROOM FOR A LITTLE WANDERLUST</span>
              <h2>
                What kind of trip
                <br />
                <em>is calling you?</em>
              </h2>
            </div>
            <Link to="/services?category=activity" className="text-link">
              Find your next experience ↗
            </Link>
          </div>
          <div className="inspiration-grid">
            <Link
              className="inspiration-card"
              to="/services?category=activity"
              data-reveal
            >
              <TravelPhoto
                name="barcelona"
                alt="Barcelona rooftops glowing in the evening sun"
              />
              <div>
                <span>CITY DAYS</span>
                <h3>
                  A new corner.
                  <br />A new story.
                </h3>
                <span>Explore city experiences ↗</span>
              </div>
            </Link>
            <Link className="inspiration-card" to="/services?category=hotel" data-reveal>
              <TravelPhoto
                name="hotel-pool"
                alt="A palm-lined swimming pool at Mission Bay Resort, San Diego"
              />
              <div>
                <span>SLOW MORNINGS</span>
                <h3>
                  A stay worth
                  <br />
                  slowing down for.
                </h3>
                <span>Explore stays and more ↗</span>
              </div>
            </Link>
            <Link className="inspiration-card" to="/trips" data-reveal>
              <TravelPhoto
                name="lake-como"
                alt="Lake Como with mountain silhouettes at sunset"
              />
              <div>
                <span>OPEN POSSIBILITIES</span>
                <h3>
                  A little further.
                  <br />A little freer.
                </h3>
                <span>Start your next plan ↗</span>
              </div>
            </Link>
          </div>
          <p className="photo-context">
            Real travel inspiration. Photos illustrate the experience; they are not images
            of our demo service providers.
          </p>
        </section>

        <section className="journey-section">
          <span className="discovery-kicker">FROM “WHAT IF” TO “LET’S GO”</span>
          <h2>
            One journey.
            <br />
            <em>A clearer way through.</em>
          </h2>
          <ol className="journey-steps">
            {[
              ['01', 'Plan', 'Pick your dates, travelers and estimated budget.'],
              ['02', 'Book', 'Explore services and try the simulated checkout.'],
              ['03', 'Prepare', 'Review essentials, costs and support before leaving.'],
              ['04', 'Travel', 'Keep bookings, wallet activity and help in reach.'],
            ].map(([number, title, text]) => (
              <li key={number} data-reveal>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="discovery-section connected-example">
          <div>
            <span className="discovery-kicker">PICTURE IT ALL COMING TOGETHER</span>
            <h2>
              A Barcelona escape.
              <br />
              <em>Without the guesswork.</em>
            </h2>
            <p>
              Create a trip, compare services, and build a cost estimate. Booked costs can
              sit alongside additional expenses without counting linked estimates twice.
            </p>
            <p>
              Keep simulated wallet credit separate, check your readiness, and open a help
              request if plans change.
            </p>
            <Link to="/#planner" className="site-button">
              Try the cost planner ↗
            </Link>
          </div>
          <div className="example-plan" data-reveal>
            <div className="example-plan-head">
              <span>ILLUSTRATIVE PLAN · EUR</span>
              <strong>Barcelona, your way.</strong>
              <small>Example amounts, not a live quote</small>
            </div>
            <dl>
              {[
                ['Transport', '€600'],
                ['Stay', '€480'],
                ['Food & experiences', '€200'],
                ['Connectivity', '€20'],
                ['Safety buffer', '€100'],
              ].map(([name, amount]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{amount}</dd>
                </div>
              ))}
              <div className="example-total">
                <dt>Estimated total</dt>
                <dd>€1,400</dd>
              </div>
            </dl>
            <p>
              Future costs ≠ wallet balance.
              <br />
              Planning this trip does not charge you.
            </p>
          </div>
        </section>

        <section className="support-story" data-reveal>
          <div className="support-story-mark" aria-hidden="true">
            ↗
          </div>
          <div>
            <span className="discovery-kicker">A HELPING HAND, WHEREVER YOU ARE</span>
            <h2>
              Backup doesn’t have
              <br />
              to come from family.
            </h2>
            <p>
              A friend, a partner, or anyone you trust can help. Try a simulated wallet
              contribution or a cash-package code that you redeem for demo cash collection
              or wallet credit.
            </p>
            <Link to="/#funds" className="site-button">
              Discover travel funds ↗
            </Link>
          </div>
          <p className="support-story-note">
            DEMO ONLY
            <br />
            <span>No real transfers, cash pickup or bank-issued cards.</span>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
