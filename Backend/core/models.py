import random
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class User(AbstractUser):
    class Role(models.TextChoices):
        PASSENGER = 'PASSENGER', 'Passenger'
        DRIVER = 'DRIVER', 'Driver'
        ADMIN = 'ADMIN', 'Admin'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PASSENGER)
    phone_number = models.CharField(max_length=20, blank=True, default='')
    is_verified = models.BooleanField(default=False)
    is_suspended = models.BooleanField(default=False)
    verification_code_hash = models.CharField(max_length=128, blank=True, default='')
    verification_code_expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class PassengerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='passenger_profile')
    home_address = models.CharField(max_length=255, blank=True, default='')
    work_address = models.CharField(max_length=255, blank=True, default='')
    loyalty_points = models.IntegerField(default=0)

    def __str__(self):
        return f"PassengerProfile: {self.user.username}"


class DriverProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending Verification'
        VERIFIED = 'VERIFIED', 'Verified'
        REJECTED = 'REJECTED', 'Rejected'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    license_number = models.CharField(max_length=50, blank=True, default='')
    license_document_url = models.CharField(max_length=500, blank=True, default='')
    verification_status = models.CharField(
        max_length=20, 
        choices=VerificationStatus.choices, 
        default=VerificationStatus.PENDING
    )
    is_online = models.BooleanField(default=False)
    current_latitude = models.FloatField(null=True, blank=True, default=3.8480) # Default Yaounde coords
    current_longitude = models.FloatField(null=True, blank=True, default=11.5021)
    rating_avg = models.FloatField(default=5.0)
    total_rides = models.IntegerField(default=0)

    def __str__(self):
        return f"DriverProfile: {self.user.username} [{self.verification_status}]"


class VehicleOwner(models.Model):
    name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True, default='')

    def __str__(self):
        return self.name


class Vehicle(models.Model):
    class Category(models.TextChoices):
        ECONOMY = 'ECONOMY', 'Economy'
        COMFORT = 'COMFORT', 'Comfort'
        COMFORT_PLUS = 'COMFORT_PLUS', 'Comfort+'
        MOTO = 'MOTO', 'Moto'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Verification'
        VERIFIED = 'VERIFIED', 'Verified'
        REJECTED = 'REJECTED', 'Rejected'

    owner = models.ForeignKey(VehicleOwner, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicles')
    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    color = models.CharField(max_length=30, blank=True, default='')
    image_url = models.CharField(max_length=500, blank=True, default='')
    year = models.IntegerField(default=2020)
    license_plate = models.CharField(max_length=20, unique=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.ECONOMY)
    verification_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    def __str__(self):
        return f"{self.make} {self.model} ({self.license_plate})"


class DriverVehicleAssignment(models.Model):
    driver = models.ForeignKey(DriverProfile, on_delete=models.CASCADE, related_name='assignments')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='assignments')
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.driver.user.username} -> {self.vehicle.license_plate}"


class RideCategory(models.Model):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20, unique=True)
    base_fare = models.DecimalField(max_digits=10, decimal_places=2, default=500.00)
    rate_per_km = models.DecimalField(max_digits=10, decimal_places=2, default=200.00)
    multiplier = models.FloatField(default=1.0)

    def __str__(self):
        return self.name


class Ride(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'REQUESTED', 'Requested'
        MATCHING = 'MATCHING', 'Matching Driver'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DRIVER_ARRIVING = 'DRIVER_ARRIVING', 'Driver Arriving'
        DRIVER_AT_PICKUP = 'DRIVER_AT_PICKUP', 'Driver at Pickup'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED_BY_PASSENGER = 'CANCELLED_BY_PASSENGER', 'Cancelled by Passenger'
        CANCELLED_BY_DRIVER = 'CANCELLED_BY_DRIVER', 'Cancelled by Driver'

    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        FAILED = 'FAILED', 'Failed'

    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='passenger_rides')
    driver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='driver_rides')
    category = models.ForeignKey(RideCategory, on_delete=models.PROTECT, related_name='rides')
    
    pickup_name = models.CharField(max_length=255)
    pickup_lat = models.FloatField(default=3.8480)
    pickup_lng = models.FloatField(default=11.5021)
    
    destination_name = models.CharField(max_length=255)
    destination_lat = models.FloatField(default=3.8600)
    destination_lng = models.FloatField(default=11.5150)
    
    distance_km = models.FloatField(default=5.0)
    estimated_fare = models.DecimalField(max_digits=10, decimal_places=2)
    final_fare = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.REQUESTED)
    is_shareable = models.BooleanField(default=False)
    is_shared = models.BooleanField(default=False)
    
    cash_otp = models.CharField(max_length=6, blank=True, default='')
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.cash_otp:
            self.cash_otp = str(random.randint(1000, 9999))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Ride #{self.id}: {self.passenger.username} ({self.status})"


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = 'CASH', 'Cash'
        MOBILE_MONEY = 'MOBILE_MONEY', 'Mobile Money'
        CARD = 'CARD', 'Card'
        WALLET = 'WALLET', 'Wallet'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SUCCESSFUL = 'SUCCESSFUL', 'Successful'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'

    ride = models.OneToOneField(Ride, on_delete=models.CASCADE, related_name='payment')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    transaction_ref = models.CharField(max_length=100, blank=True, default='')
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.amount} FCFA for Ride #{self.ride.id} [{self.status}]"


class SharedRide(models.Model):
    class SharedStatus(models.TextChoices):
        SEARCHING = 'SEARCHING', 'Searching'
        SHAREABLE = 'SHAREABLE', 'Available to Join'
        FULL = 'FULL', 'Full'
        COMPLETED = 'COMPLETED', 'Completed'

    primary_ride = models.OneToOneField(Ride, on_delete=models.CASCADE, related_name='shared_ride_group')
    capacity = models.IntegerField(default=4) # 4 passenger places in car (excluding driver)
    available_seats = models.IntegerField(default=3) # Primary passenger occupies 1 place, leaving 3 available
    status = models.CharField(max_length=20, choices=SharedStatus.choices, default=SharedStatus.SHAREABLE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SharedRide Group for Ride #{self.primary_ride.id} [{self.status}]"


class SharedRideParticipant(models.Model):
    shared_ride = models.ForeignKey(SharedRide, on_delete=models.CASCADE, related_name='participants')
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_ride_participations')
    
    pickup_name = models.CharField(max_length=255)
    pickup_lat = models.FloatField()
    pickup_lng = models.FloatField()
    
    destination_name = models.CharField(max_length=255)
    destination_lat = models.FloatField()
    destination_lng = models.FloatField()
    
    solo_distance_km = models.FloatField()
    solo_calculated_fare = models.DecimalField(max_digits=10, decimal_places=2)
    allocated_shared_fare = models.DecimalField(max_digits=10, decimal_places=2)
    
    payment_status = models.CharField(max_length=20, choices=Ride.PaymentStatus.choices, default=Ride.PaymentStatus.PENDING)
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Participant {self.passenger.username} on SharedRide #{self.shared_ride.id}"


class DriverEarning(models.Model):
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='earnings')
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='earnings')
    gross_fare = models.DecimalField(max_digits=10, decimal_places=2)
    commission_rate = models.FloatField(default=15.0) # 15% platform commission
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2)
    net_earning = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Earning Driver {self.driver.username}: {self.net_earning} FCFA"


class WithdrawalRequest(models.Model):
    class WithdrawalStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        PROCESSED = 'PROCESSED', 'Processed'

    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='withdrawals')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=WithdrawalStatus.choices, default=WithdrawalStatus.PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Withdrawal {self.driver.username}: {self.amount} FCFA [{self.status}]"


class Rating(models.Model):
    ride = models.OneToOneField(Ride, on_delete=models.CASCADE, related_name='rating')
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_ratings')
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_ratings')
    score = models.IntegerField(default=5) # 1 to 5
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Rating {self.score}/5 for Ride #{self.ride.id}"


class DemandObservation(models.Model):
    zone_name = models.CharField(max_length=100) # e.g. Mvan, Bastos, Mokolo, Biyem-Assi
    latitude = models.FloatField()
    longitude = models.FloatField()
    hour_of_day = models.IntegerField() # 0 to 23
    day_of_week = models.IntegerField() # 0 to 6
    request_count = models.IntegerField(default=1)

    def __str__(self):
        return f"DemandZone: {self.zone_name} @ Hour {self.hour_of_day} (Count: {self.request_count})"


class AIRecommendation(models.Model):
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_recommendations')
    title = models.CharField(max_length=150)
    message = models.TextField()
    target_zone = models.CharField(max_length=100)
    time_window = models.CharField(max_length=50) # e.g. "17:00 - 19:00"
    confidence = models.FloatField(default=0.88)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"AI Recommendation for {self.driver.username}: {self.title}"
