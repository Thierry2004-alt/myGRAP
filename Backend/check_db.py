import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Ride, SharedRide, DriverVehicleAssignment, DriverProfile, User

shared = SharedRide.objects.filter(status='SHAREABLE').select_related('primary_ride__driver').all()
print(f'Active SHAREABLE shared rides: {shared.count()}')
for s in shared:
    r = s.primary_ride
    print(f'  SharedRide #{s.id} -> Ride #{r.id}, passenger={r.passenger.username}, driver={r.driver}, status={r.status}')
    if r.driver:
        print(f'    Driver username: {r.driver.username}')
        print(f'    Driver full name: "{r.driver.get_full_name()}"')
        if hasattr(r.driver, 'driver_profile'):
            dp = r.driver.driver_profile
            print(f'    Rating: {dp.rating_avg}, rides: {dp.total_rides}')
            assign = dp.assignments.filter(is_active=True).select_related('vehicle').first()
            if assign:
                v = assign.vehicle
                print(f'    Vehicle: make={v.make} model={v.model} color="{v.color}" plate={v.license_plate}')
            else:
                print('    !!! NO ACTIVE VEHICLE ASSIGNMENT')
        else:
            print('    !!! NO DRIVER PROFILE')
    else:
        print('    !!! NO DRIVER ASSIGNED TO RIDE')

print()
print('--- All DriverVehicleAssignments ---')
for a in DriverVehicleAssignment.objects.select_related('driver__user', 'vehicle').all():
    print(f'  Driver={a.driver.user.username}, Vehicle={a.vehicle.make} {a.vehicle.model} {a.vehicle.license_plate}, active={a.is_active}')
