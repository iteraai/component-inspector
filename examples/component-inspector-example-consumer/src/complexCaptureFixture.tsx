const categories = [
  {
    id: 'amazing-pools',
    label: 'Amazing pools',
    iconPath: 'M4 13h16v5H4z M7 8h10v5H7z M9 5h6v3H9z',
  },
  {
    id: 'beachfront',
    label: 'Beachfront',
    iconPath: 'M5 18h14 M8 15h8l-4-8z M12 3v3 M9 6h6',
  },
  {
    id: 'cabins',
    label: 'Cabins',
    iconPath: 'M3 11l9-7 9 7 M6 10v9h12v-9 M10 19v-5h4v5',
  },
  {
    id: 'tropical',
    label: 'Tropical',
    iconPath: 'M12 20V8 M5 8c4-5 10-5 14 0 M4 9c4 1 6 2 8 6 M20 9c-4 1-6 2-8 6',
  },
  {
    id: 'countryside',
    label: 'Countryside',
    iconPath: 'M4 18h16L14 7l-4 6-2-3z M16 6h2v2h-2z',
  },
  {
    id: 'lakefront',
    label: 'Lakefront',
    iconPath: 'M7 16c2 2 4 2 6 0s4-2 6 0 M5 19c2 2 4 2 6 0s4-2 8 0 M12 5l5 8H7z',
  },
] as const;

const SearchIcon = () => {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24'>
      <path d='M10.5 18a7.5 7.5 0 1 1 5.3-12.8 7.5 7.5 0 0 1-5.3 12.8Z' />
      <path d='m16 16 4 4' />
    </svg>
  );
};

const GlobeIcon = () => {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24'>
      <circle cx='12' cy='12' r='9' />
      <path d='M3 12h18 M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21 M12 3c-2.5 2.7-3.8 5.7-3.8 9s1.3 6.3 3.8 9' />
    </svg>
  );
};

const MenuIcon = () => {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24'>
      <path d='M5 7h14 M5 12h14 M5 17h14' />
    </svg>
  );
};

export const ComplexCaptureFixture = () => {
  return (
    <section
      data-inspector-node-id='complex-capture-fixture'
      className='complex-capture-fixture'
      aria-label='Complex screenshot fixture'
    >
      <header className='complex-capture-header'>
        <div className='complex-capture-brand' aria-label='Airbnb'>
          <svg aria-hidden='true' viewBox='0 0 32 32'>
            <path d='M16 3c4 6 8 13 10 18 1.6 4.2-2.8 7.7-6.5 5.4L16 24l-3.5 2.4C8.8 28.7 4.4 25.2 6 21 8 16 12 9 16 3Z' />
            <path d='M16 12c-2.1 0-3.7 1.7-3.7 3.7s1.6 3.7 3.7 3.7 3.7-1.7 3.7-3.7S18.1 12 16 12Z' />
          </svg>
          <strong>airbnb</strong>
        </div>

        <div className='complex-capture-search' aria-label='Search stays'>
          <button type='button'>Anywhere</button>
          <button type='button'>Any week</button>
          <button type='button'>Add guests</button>
          <span className='complex-capture-search-button'>
            <SearchIcon />
          </span>
        </div>

        <div className='complex-capture-actions'>
          <button type='button' aria-label='Language and region'>
            <GlobeIcon />
          </button>
          <button type='button' aria-label='Profile menu'>
            <MenuIcon />
            <span className='complex-capture-avatar'>A</span>
          </button>
        </div>
      </header>

      <nav className='complex-capture-categories' aria-label='Categories'>
        {categories.map((category) => (
          <button
            key={category.id}
            type='button'
            className='complex-capture-category'
            data-testid={`complex-category-${category.id}`}
          >
            <svg aria-hidden='true' viewBox='0 0 24 24'>
              <path d={category.iconPath} />
            </svg>
            <span>{category.label}</span>
          </button>
        ))}
        <button
          type='button'
          className='complex-capture-next'
          aria-label='Next categories'
        >
          <svg aria-hidden='true' viewBox='0 0 24 24'>
            <path d='m9 6 6 6-6 6' />
          </svg>
        </button>
      </nav>
    </section>
  );
};
