from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    User, PassengerProfile, DriverProfile, VehicleOwner, Vehicle,
    DriverVehicleAssignment, RideCategory, Ride, SharedRide,
    SharedRideParticipant, DriverEarning, WithdrawalRequest,
    Rating, DemandObservation, AIRecommendation, Place
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone_number', 'profile_picture_url', 'is_verified', 'is_suspended']
        read_only_fields = ['id', 'is_verified', 'is_suspended']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    license_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    license_document_url = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=500)
    vehicle_make = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vehicle_model = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vehicle_year = serializers.IntegerField(write_only=True, required=False, min_value=1950, max_value=2100)
    vehicle_color = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vehicle_license_plate = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vehicle_category = serializers.ChoiceField(write_only=True, required=False, choices=Vehicle.Category.choices)
    vehicle_image_url = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=500)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone_number',
            'license_number', 'license_document_url', 'vehicle_make', 'vehicle_model', 'vehicle_year',
            'vehicle_color', 'vehicle_license_plate', 'vehicle_category', 'vehicle_image_url'
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        role = validated_data.get('role', User.Role.PASSENGER)
        license_number = validated_data.pop('license_number', '')
        license_document_url = validated_data.pop('license_document_url', '')
        vehicle_data = {
            'make': validated_data.pop('vehicle_make', ''),
            'model': validated_data.pop('vehicle_model', ''),
            'year': validated_data.pop('vehicle_year', 2020),
            'color': validated_data.pop('vehicle_color', ''),
            'license_plate': validated_data.pop('vehicle_license_plate', ''),
            'category': validated_data.pop('vehicle_category', Vehicle.Category.ECONOMY),
            'image_url': validated_data.pop('vehicle_image_url', ''),
        }
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        
        # Create corresponding profile
        if role == User.Role.PASSENGER:
            PassengerProfile.objects.create(user=user)
        elif role == User.Role.DRIVER:
            driver_profile = DriverProfile.objects.create(
                user=user,
                license_number=license_number,
                license_document_url=license_document_url,
            )
            if vehicle_data['make'] and vehicle_data['model'] and vehicle_data['license_plate']:
                vehicle = Vehicle.objects.create(**vehicle_data)
                DriverVehicleAssignment.objects.create(driver=driver_profile, vehicle=vehicle)
        
        return user


class PassengerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = PassengerProfile
        fields = '__all__'


class DriverProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = DriverProfile
        fields = '__all__'


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'


class DriverVehicleAssignmentSerializer(serializers.ModelSerializer):
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)
    class Meta:
        model = DriverVehicleAssignment
        fields = '__all__'


class RideCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RideCategory
        fields = '__all__'


class PlaceSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = [
            'id', 'slug', 'name', 'category', 'category_code', 'zone', 'icon',
            'latitude', 'longitude', 'description', 'highlights', 'search_keywords',
            'photo_url', 'photo_credit', 'photo_license', 'photo_source_url',
            'map_source_url',
        ]

    def get_photo_url(self, obj):
        request = self.context.get('request')
        image_url = obj.image_url
        if obj.image_path:
            from django.templatetags.static import static
            image_url = static(obj.image_path)
        if image_url and request:
            return request.build_absolute_uri(image_url)
        return image_url


class RideSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.get_full_name', read_only=True)
    passenger_username = serializers.CharField(source='passenger.username', read_only=True)
    passenger_profile_picture_url = serializers.CharField(source='passenger.profile_picture_url', read_only=True)
    passenger_phone = serializers.CharField(source='passenger.phone_number', read_only=True)
    driver_name = serializers.SerializerMethodField()
    driver_username = serializers.SerializerMethodField()
    driver_profile_picture_url = serializers.SerializerMethodField()
    driver_phone_number = serializers.SerializerMethodField()
    driver_rating = serializers.SerializerMethodField()
    driver_total_rides = serializers.SerializerMethodField()
    vehicle_info = serializers.SerializerMethodField()
    driver_latitude = serializers.SerializerMethodField()
    driver_longitude = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_code = serializers.CharField(source='category.code', read_only=True)
    category_base_fare = serializers.DecimalField(source='category.base_fare', read_only=True, max_digits=10, decimal_places=2)
    category_rate_per_km = serializers.DecimalField(source='category.rate_per_km', read_only=True, max_digits=10, decimal_places=2)
    shared_ride_id = serializers.IntegerField(source='shared_ride_group.id', read_only=True)
    cash_otp = serializers.SerializerMethodField()

    def get_cash_otp(self, obj):
        request = self.context.get('request')
        if request and getattr(request.user, 'id', None) == obj.passenger_id:
            return obj.cash_otp
        return None

    def get_driver_name(self, obj):
        if not obj.driver:
            return None
        return obj.driver.get_full_name() or obj.driver.username

    def get_driver_username(self, obj):
        return obj.driver.username if obj.driver else None

    def get_driver_profile_picture_url(self, obj):
        return getattr(getattr(obj, 'driver', None), 'profile_picture_url', '') or ''

    def get_driver_phone_number(self, obj):
        return getattr(getattr(obj, 'driver', None), 'phone_number', '') or ''

    def get_driver_rating(self, obj):
        if not obj.driver or not hasattr(obj.driver, 'driver_profile'):
            return 5.0
        return round(float(obj.driver.driver_profile.rating_avg or 5.0), 1)

    def get_driver_total_rides(self, obj):
        if not obj.driver or not hasattr(obj.driver, 'driver_profile'):
            return 0
        return int(obj.driver.driver_profile.total_rides or 0)

    def get_vehicle_info(self, obj):
        if not obj.driver or not hasattr(obj.driver, 'driver_profile'):
            return None
        assignment = obj.driver.driver_profile.assignments.filter(is_active=True).select_related('vehicle').first()
        if assignment and assignment.vehicle:
            v = assignment.vehicle
            return f"{v.make} {v.model} • {v.license_plate}"
        return None

    def get_driver_latitude(self, obj):
        if obj.driver and hasattr(obj.driver, 'driver_profile'):
            return obj.driver.driver_profile.current_latitude
        return None

    def get_driver_longitude(self, obj):
        if obj.driver and hasattr(obj.driver, 'driver_profile'):
            return obj.driver.driver_profile.current_longitude
        return None

    class Meta:
        model = Ride
        fields = [
            'id', 'passenger', 'driver', 'passenger_name', 'passenger_username', 'passenger_profile_picture_url', 'passenger_phone',
            'driver_name', 'driver_username', 'driver_profile_picture_url', 'driver_phone_number', 'driver_rating', 'driver_total_rides',
            'vehicle_info', 'driver_latitude', 'driver_longitude', 'shared_ride_id',
            'category', 'category_name', 'category_code', 'category_base_fare', 'category_rate_per_km',
            'pickup_name', 'pickup_lat', 'pickup_lng',
            'destination_name', 'destination_lat', 'destination_lng',
            'distance_km', 'estimated_fare', 'final_fare', 'status',
            'is_shareable', 'is_shared', 'cash_otp', 'payment_status',
            'created_at', 'completed_at'
        ]
        read_only_fields = ['id', 'driver', 'final_fare', 'status', 'is_shared', 'cash_otp', 'payment_status', 'created_at', 'completed_at']


class SharedRideParticipantSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.get_full_name', read_only=True)
    passenger_username = serializers.CharField(source='passenger.username', read_only=True)
    passenger_phone = serializers.CharField(source='passenger.phone_number', read_only=True)
    passenger_profile_picture_url = serializers.CharField(source='passenger.profile_picture_url', read_only=True)
    primary_ride_id = serializers.IntegerField(source='shared_ride.primary_ride.id', read_only=True)
    initiator_name = serializers.CharField(source='shared_ride.primary_ride.passenger.get_full_name', read_only=True)
    initiator_username = serializers.CharField(source='shared_ride.primary_ride.passenger.username', read_only=True)
    initiator_profile_picture_url = serializers.CharField(source='shared_ride.primary_ride.passenger.profile_picture_url', read_only=True)
    initiator_phone = serializers.CharField(source='shared_ride.primary_ride.passenger.phone_number', read_only=True)
    driver_name = serializers.CharField(source='shared_ride.primary_ride.driver.get_full_name', read_only=True)
    driver_username = serializers.CharField(source='shared_ride.primary_ride.driver.username', read_only=True)
    driver_profile_picture_url = serializers.CharField(source='shared_ride.primary_ride.driver.profile_picture_url', read_only=True)
    driver_phone_number = serializers.CharField(source='shared_ride.primary_ride.driver.phone_number', read_only=True)
    cash_otp = serializers.SerializerMethodField()
    primary_status = serializers.CharField(source='shared_ride.primary_ride.status', read_only=True)
    primary_estimated_fare = serializers.DecimalField(source='shared_ride.primary_ride.estimated_fare', max_digits=10, decimal_places=2, read_only=True)
    vehicle_info = serializers.SerializerMethodField()

    def get_vehicle_info(self, obj):
        driver = getattr(getattr(obj, 'shared_ride', None), 'primary_ride', None)
        driver_user = getattr(driver, 'driver', None) if driver else None
        if not driver_user or not hasattr(driver_user, 'driver_profile'):
            return None
        assignment = driver_user.driver_profile.assignments.filter(is_active=True).select_related('vehicle').first()
        if assignment and assignment.vehicle:
            v = assignment.vehicle
            return f"{v.make} {v.model} • {v.license_plate}"
        return None

    def get_cash_otp(self, obj):
        return None

    class Meta:
        model = SharedRideParticipant
        fields = [
            'id', 'shared_ride', 'primary_ride_id', 'passenger', 'passenger_name', 'passenger_username', 'passenger_phone', 'passenger_profile_picture_url',
            'initiator_name', 'initiator_username', 'initiator_profile_picture_url', 'initiator_phone',
            'driver_name', 'driver_username', 'driver_profile_picture_url', 'driver_phone_number', 'vehicle_info', 'cash_otp', 'primary_status', 'primary_estimated_fare',
            'pickup_name', 'pickup_lat', 'pickup_lng', 'destination_name', 'destination_lat', 'destination_lng',
            'solo_distance_km', 'solo_calculated_fare', 'allocated_shared_fare', 'payment_status', 'joined_at'
        ]


class SharedRideSerializer(serializers.ModelSerializer):
    primary_ride = RideSerializer(read_only=True)
    participants = SharedRideParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = SharedRide
        fields = ['id', 'primary_ride', 'capacity', 'available_seats', 'status', 'participants', 'created_at']


class DriverEarningSerializer(serializers.ModelSerializer):
    ride_details = RideSerializer(source='ride', read_only=True)

    class Meta:
        model = DriverEarning
        fields = '__all__'


class WithdrawalRequestSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.username', read_only=True)

    class Meta:
        model = WithdrawalRequest
        fields = '__all__'
        read_only_fields = ['id', 'status', 'requested_at', 'processed_at']


class RatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = '__all__'
        read_only_fields = ['id', 'passenger', 'created_at']


class DemandObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DemandObservation
        fields = '__all__'


class AIRecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRecommendation
        fields = '__all__'


class DriverProposalSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='user.get_full_name', read_only=True)
    driver_profile_picture_url = serializers.CharField(source='user.profile_picture_url', read_only=True)
    driver_phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    vehicle_info = serializers.SerializerMethodField()
    vehicle_category = serializers.SerializerMethodField()

    class Meta:
        model = DriverProfile
        fields = ['id', 'driver_name', 'driver_profile_picture_url', 'driver_phone_number', 'vehicle_info', 'vehicle_category', 'rating_avg', 'total_rides']

    def get_vehicle_info(self, obj):
        assignment = obj.assignments.filter(is_active=True).select_related('vehicle').first()
        if assignment:
            v = assignment.vehicle
            return f"{v.make} {v.model} • {v.license_plate}"
        return 'Vehicle not assigned'

    def get_vehicle_category(self, obj):
        assignment = obj.assignments.filter(is_active=True).select_related('vehicle').first()
        if assignment:
            return assignment.vehicle.category
        return 'ECONOMY'
