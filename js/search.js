/**
 * Filter characters by free-text query across name, number, sponsor, and movies.
 * Optional movie filter ('Cars', 'Cars 2', 'Cars 3').
 */
export function searchCars(data, query, movieFilter) {
  let results = data;

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    results = results.filter(car =>
      car.name.toLowerCase().includes(q) ||
      (car.number && car.number.toLowerCase().includes(q)) ||
      (car.sponsor && car.sponsor.toLowerCase().includes(q)) ||
      (car.movies || []).some(m => m.toLowerCase().includes(q))
    );
  }

  if (movieFilter) {
    results = results.filter(car =>
      (car.movies || []).includes(movieFilter)
    );
  }

  return results;
}
