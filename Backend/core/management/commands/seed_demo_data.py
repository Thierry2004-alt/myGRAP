from django.core.management.base import BaseCommand
from core.models import (
    User, PassengerProfile, DriverProfile, VehicleOwner, Vehicle,
    DriverVehicleAssignment, RideCategory, DemandObservation, Ride
)

class Command(BaseCommand):
    help = 'Seeds initial ride categories, demo users (Passenger, Driver, Admin), and sample demand data.'

    def handle(self, *args, **options):
        self.stdout.write("Seeding GRAP demo data...")

        # 1. Ride Categories
        categories_data = [
            {'name': 'Economy', 'code': 'ECONOMY', 'base_fare': 500.00, 'rate_per_km': 200.00, 'multiplier': 1.0},
            {'name': 'Comfort', 'code': 'COMFORT', 'base_fare': 800.00, 'rate_per_km': 300.00, 'multiplier': 1.2},
            {'name': 'Comfort+', 'code': 'COMFORT_PLUS', 'base_fare': 1200.00, 'rate_per_km': 450.00, 'multiplier': 1.5},
            {'name': 'Moto', 'code': 'MOTO', 'base_fare': 300.00, 'rate_per_km': 150.00, 'multiplier': 0.8},
        ]
        for cat in categories_data:
            RideCategory.objects.get_or_create(code=cat['code'], defaults=cat)
        self.stdout.write("-> Ride Categories created.")

        # 2. Demo Admin User
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@grap.cm',
                'role': User.Role.ADMIN,
                'first_name': 'System',
                'last_name': 'Admin',
                'is_staff': True,
                'is_superuser': True,
                'is_verified': True
            }
        )
        if created:
            admin_user.set_password('password123')
            admin_user.save()

        # 3. Demo Passenger User
        p_user, created = User.objects.get_or_create(
            username='passenger1',
            defaults={
                'email': 'passenger@grap.cm',
                'role': User.Role.PASSENGER,
                'first_name': 'Jean',
                'last_name': 'Kamga',
                'phone_number': '+237690001122',
                'is_verified': True
            }
        )
        if created:
            p_user.set_password('password123')
            p_user.save()
            PassengerProfile.objects.get_or_create(user=p_user, defaults={'home_address': 'Bastos', 'work_address': 'Mvan', 'loyalty_points': 150})

        # 4. Demo Driver User & Vehicle
        d_user, created = User.objects.get_or_create(
            username='driver1',
            defaults={
                'email': 'driver@grap.cm',
                'role': User.Role.DRIVER,
                'first_name': 'Paul',
                'last_name': 'Nkoa',
                'phone_number': '+237670003344',
                'is_verified': True
            }
        )
        if created:
            d_user.set_password('password123')
            d_user.save()
            d_profile, _ = DriverProfile.objects.get_or_create(
                user=d_user,
                defaults={
                    'license_number': 'CMR-LIC-9982',
                    'verification_status': DriverProfile.VerificationStatus.VERIFIED,
                    'is_online': True,
                    'rating_avg': 4.9,
                    'total_rides': 42
                }
            )
            # Create vehicle assignment
            owner, _ = VehicleOwner.objects.get_or_create(name='Fleet Owner Ltd', phone_number='+237699112233')
            veh, _ = Vehicle.objects.get_or_create(
                license_plate='CE-992-AA',
                defaults={
                    'owner': owner,
                    'make': 'Toyota',
                    'model': 'Yaris',
                    'year': 2021,
                    'category': Vehicle.Category.ECONOMY,
                    'verification_status': Vehicle.Status.VERIFIED
                }
            )
            DriverVehicleAssignment.objects.get_or_create(driver=d_profile, vehicle=veh, is_active=True)

        self.stdout.write("-> Demo users & vehicles created.")

        # 5. Demand Observations (Yaounde zones)
        sample_demands = [
            {'zone_name': 'Mvan Bus Station', 'latitude': 3.8400, 'longitude': 11.5000, 'hour_of_day': 17, 'day_of_week': 1, 'request_count': 18},
            {'zone_name': 'Bastos Ambassades', 'latitude': 3.8750, 'longitude': 11.5180, 'hour_of_day': 18, 'day_of_week': 1, 'request_count': 24},
            {'zone_name': 'Mokolo Market', 'latitude': 3.8680, 'longitude': 11.5050, 'hour_of_day': 8, 'day_of_week': 2, 'request_count': 30},
            {'zone_name': 'Biyem-Assi Carrefour', 'latitude': 3.8320, 'longitude': 11.4900, 'hour_of_day': 13, 'day_of_week': 3, 'request_count': 12},
        ]
        for d in sample_demands:
            DemandObservation.objects.get_or_create(zone_name=d['zone_name'], hour_of_day=d['hour_of_day'], defaults=d)

        self.stdout.write(self.style.SUCCESS("Successfully seeded GRAP demo data!"))
