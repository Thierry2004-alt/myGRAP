from django.core.management.base import BaseCommand
from core.models import Ride, SharedRide, SharedRideParticipant, DriverEarning, WithdrawalRequest

class Command(BaseCommand):
    help = 'Flushes all dummy ride history and shared ride data while preserving accounts, vehicles, and categories.'

    def handle(self, *args, **options):
        self.stdout.write("Clearing dummy ride and shared ride data...")
        
        p_count = SharedRideParticipant.objects.all().delete()[0]
        sr_count = SharedRide.objects.all().delete()[0]
        r_count = Ride.objects.all().delete()[0]
        e_count = DriverEarning.objects.all().delete()[0]
        w_count = WithdrawalRequest.objects.all().delete()[0]

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully deleted {p_count} shared participants, {sr_count} shared rides, {r_count} rides, {e_count} earnings, {w_count} withdrawal requests.\nDatabase is now clean for live defense!"
            )
        )
