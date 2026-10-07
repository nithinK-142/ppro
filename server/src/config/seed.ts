import { transaction } from './db.ts';
import logger from '../utils/logger.ts';

const tasks = [
  ['Errands & Daily Tasks', 'Courier pickup or drop', 'Collect or deliver a parcel locally.'],
  ['Errands & Daily Tasks', 'Grocery restocking', 'Pick up a prepared grocery list and restock the home.'],
  ['Errands & Daily Tasks', 'Medicine pickup', 'Collect a prescription refill from a pharmacy.'],
  ['Errands & Daily Tasks', 'Bank visit assistance', 'Handle a routine in-person bank errand on your behalf.'],
  ['Errands & Daily Tasks', 'Document printing and scanning', 'Print, scan, or prepare routine documents for pickup.'],
  ['Home Services', 'AC service visit', 'Coordinate a technician for routine AC service.'],
  ['Home Services', 'Plumber visit', 'Arrange help for leaks, fittings, or minor plumbing work.'],
  ['Home Services', 'Electrician visit', 'Coordinate a technician for common electrical repairs.'],
  ['Home Services', 'Deep home cleaning', 'Arrange a vetted team for a detailed home clean.'],
  ['Home Services', 'Pest control', 'Schedule a pest treatment and follow-up.'],
  ['Travel & Tourism', 'Airport pickup', 'Arrange a car and driver for an airport transfer.'],
  ['Travel & Tourism', 'Hotel shortlisting', 'Shortlist stays around your dates and requirements.'],
  ['Travel & Tourism', 'Family trip planning', 'Coordinate a simple family itinerary and bookings.'],
  ['Travel & Tourism', 'Local car rental', 'Arrange a rental car for a trip or local requirement.'],
  ['Travel & Tourism', 'Guest stay coordination', 'Handle hotel and arrival details for visiting family or friends.'],
  ['Health & Medical', 'Doctor appointment', 'Coordinate a clinic or home-visit appointment.'],
  ['Health & Medical', 'Lab report pickup', 'Collect a completed report and deliver it safely.'],
  ['Health & Medical', 'Pharmacy refill', 'Coordinate a routine medicine refill and delivery.'],
  ['Health & Medical', 'Physiotherapy session', 'Arrange a physiotherapy appointment at home or nearby.'],
  ['Health & Medical', 'Hospital visit coordination', 'Help coordinate transport and appointment logistics.'],
  ['Senior Care', 'Wellness check-in', 'Arrange a scheduled visit to check on an older family member.'],
  ['Senior Care', 'Medicine reminder support', 'Coordinate reminders and routine refill support.'],
  ['Senior Care', 'Doctor visit accompaniment', 'Arrange accompaniment for a routine appointment.'],
  ['Senior Care', 'Digital help for seniors', 'Help with a phone, app, video call, or basic digital task.'],
  ['Senior Care', 'Home safety check', 'Coordinate a practical check of common household hazards.'],
  ['Events & Management', 'Birthday planning', 'Coordinate vendors and logistics for a home birthday.'],
  ['Events & Management', 'Puja setup', 'Arrange basic vendors and setup for a family puja.'],
  ['Events & Management', 'Catering coordination', 'Shortlist and coordinate catering for a gathering.'],
  ['Events & Management', 'Decoration coordination', 'Arrange decoration and confirm the setup schedule.'],
  ['Events & Management', 'Guest travel coordination', 'Coordinate stays and local transport for guests.']
] as const;

async function seedTasks() {
  await transaction(async (query) => {
    for (const [category, name, description] of tasks) {
      await query(
        'INSERT INTO tasks (category, name, description) VALUES ($1, $2, $3) ON CONFLICT(name) DO NOTHING',
        [category, name, description]
      );
    }
  });

  logger.info({ count: tasks.length }, 'catalogue seeded');
}

export { seedTasks };
