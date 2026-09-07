from django.contrib import admin
from .models import (
    User,
    PassengerProfile,
    DriverProfile,
    VehicleOwner,
    Vehicle,
    DriverVehicleAssignment,
    RideCategory,
    Ride,
    SharedRide,
    SharedRideParticipant,
    DriverEarning,
    WithdrawalRequest,
    Rating,
    DemandObservation,
    AIRecommendation,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'is_verified', 'is_suspended', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_verified', 'is_suspended', 'is_staff', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'phone_number')
    readonly_fields = ('date_joined', 'last_login')


@admin.register(PassengerProfile)
class PassengerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'home_address', 'work_address', 'loyalty_points')
    search_fields = ('user__username', 'home_address', 'work_address')
    list_select_related = ('user',)


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'verification_status', 'is_online', 'rating_avg', 'total_rides')
    list_filter = ('verification_status', 'is_online')
    search_fields = ('user__username', 'license_number')
    list_select_related = ('user',)


@admin.register(VehicleOwner)
class VehicleOwnerAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone_number', 'email')
    search_fields = ('name', 'phone_number', 'email')


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('make', 'model', 'license_plate', 'category', 'verification_status', 'year')
    list_filter = ('category', 'verification_status', 'year')
    search_fields = ('make', 'model', 'license_plate', 'color')
    list_select_related = ('owner',)


@admin.register(DriverVehicleAssignment)
class DriverVehicleAssignmentAdmin(admin.ModelAdmin):
    list_display = ('driver', 'vehicle', 'is_active', 'assigned_at')
    list_filter = ('is_active', 'assigned_at')
    search_fields = ('driver__user__username', 'vehicle__license_plate')
    list_select_related = ('driver__user', 'vehicle')


@admin.register(RideCategory)
class RideCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'base_fare', 'rate_per_km', 'multiplier')
    search_fields = ('name', 'code')


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = ('id', 'passenger', 'driver', 'status', 'payment_status', 'pickup_name', 'destination_name', 'created_at')
    list_filter = ('status', 'payment_status', 'category', 'created_at')
    search_fields = ('pickup_name', 'destination_name', 'passenger__username', 'driver__username', 'cash_otp')
    readonly_fields = ('created_at', 'completed_at')
    list_select_related = ('passenger', 'driver', 'category')


@admin.register(SharedRide)
class SharedRideAdmin(admin.ModelAdmin):
    list_display = ('id', 'primary_ride', 'capacity', 'available_seats', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('primary_ride__pickup_name', 'primary_ride__destination_name')
    list_select_related = ('primary_ride',)


@admin.register(SharedRideParticipant)
class SharedRideParticipantAdmin(admin.ModelAdmin):
    list_display = ('passenger', 'shared_ride', 'payment_status', 'joined_at')
    list_filter = ('payment_status', 'joined_at')
    search_fields = ('passenger__username', 'pickup_name', 'destination_name')
    list_select_related = ('passenger', 'shared_ride__primary_ride')


@admin.register(DriverEarning)
class DriverEarningAdmin(admin.ModelAdmin):
    list_display = ('driver', 'ride', 'gross_fare', 'commission_amount', 'net_earning', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('driver__username', 'ride__pickup_name', 'ride__destination_name')
    list_select_related = ('driver', 'ride')


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ('driver', 'amount', 'status', 'requested_at', 'processed_at')
    list_filter = ('status', 'requested_at', 'processed_at')
    search_fields = ('driver__username',)
    list_select_related = ('driver',)


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('ride', 'passenger', 'driver', 'score', 'created_at')
    list_filter = ('score', 'created_at')
    search_fields = ('passenger__username', 'driver__username', 'comment')
    list_select_related = ('ride', 'passenger', 'driver')


@admin.register(DemandObservation)
class DemandObservationAdmin(admin.ModelAdmin):
    list_display = ('zone_name', 'hour_of_day', 'day_of_week', 'request_count', 'latitude', 'longitude')
    list_filter = ('zone_name', 'hour_of_day', 'day_of_week')
    search_fields = ('zone_name',)


@admin.register(AIRecommendation)
class AIRecommendationAdmin(admin.ModelAdmin):
    list_display = ('driver', 'title', 'target_zone', 'time_window', 'confidence', 'created_at')
    list_filter = ('target_zone', 'time_window', 'created_at')
    search_fields = ('driver__username', 'title', 'message', 'target_zone')
    list_select_related = ('driver',)