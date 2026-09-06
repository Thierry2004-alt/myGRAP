from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    User, PassengerProfile, DriverProfile, VehicleOwner, Vehicle,
    DriverVehicleAssignment, RideCategory, Ride, SharedRide,
    SharedRideParticipant, DriverEarning, WithdrawalRequest,
    Rating, DemandObservation, AIRecommendation
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone_number', 'is_verified', 'is_suspended']
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


class RideSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.get_full_name', read_only=True)
    driver_name = serializers.CharField(source='driver.get_full_name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    shared_ride_id = serializers.IntegerField(source='shared_ride_group.id', read_only=True)

    class Meta:
        model = Ride
        fields = [
            'id', 'passenger', 'driver', 'passenger_name', 'driver_name', 'shared_ride_id',
            'category', 'category_name', 'pickup_name', 'pickup_lat', 'pickup_lng',
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

    class Meta:
        model = SharedRideParticipant
        fields = [
            'id', 'shared_ride', 'passenger', 'passenger_name', 'passenger_username', 'passenger_phone',
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
