from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from core.views import (
    CustomTokenObtainPairView, RegisterView, CurrentUserView,
    RequestEmailVerificationView, VerifyEmailView, GroqPlaceRecommendationView,
    RideCategoryListView, EstimateFareView, RequestRideView,
    PassengerMyRidesView, CancelRideView,
    SearchSharedRidesView, JoinSharedRideView, SharedRideStatusView, MySharedRidesView, ConfirmSharedPaymentView, MakeRideShareableView,
    ConfirmCashPaymentView, DriverStatusView, DriverRideFeedView,
    DriverAcceptRideView, DriverUpdateRideStatusView, DriverEarningsView,
    WithdrawalRequestView, DriverAIDemandRecommendationsView,
    AdminDriverVerificationView, AdminVehicleVerificationView, AdminSystemMetricsView
)

urlpatterns = [
    # Auth
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),
    path('auth/verification/request/', RequestEmailVerificationView.as_view(), name='request_email_verification'),
    path('auth/verification/verify/', VerifyEmailView.as_view(), name='verify_email'),
    path('ai/place-recommendation/', GroqPlaceRecommendationView.as_view(), name='groq_place_recommendation'),

    # Ride Categories & Estimation & Rides
    path('categories/', RideCategoryListView.as_view(), name='categories_list'),
    path('rides/estimate/', EstimateFareView.as_view(), name='estimate_fare'),
    path('rides/request/', RequestRideView.as_view(), name='request_ride'),
    path('rides/my-rides/', PassengerMyRidesView.as_view(), name='passenger_my_rides'),
    path('rides/cancel/<int:ride_id>/', CancelRideView.as_view(), name='cancel_ride'),

    # Voluntary Dynamic Ride Sharing
    path('rides/shared/search/', SearchSharedRidesView.as_view(), name='search_shared_rides'),
    path('rides/shared/join/', JoinSharedRideView.as_view(), name='join_shared_ride'),
    path('rides/shared/<int:shared_ride_id>/', SharedRideStatusView.as_view(), name='shared_ride_status'),
    path('rides/shared/mine/', MySharedRidesView.as_view(), name='my_shared_rides'),
    path('rides/shared/participant/<int:participant_id>/confirm-payment/', ConfirmSharedPaymentView.as_view(), name='confirm_shared_payment'),
    path('rides/shared/make-shareable/', MakeRideShareableView.as_view(), name='make_ride_shareable'),

    # Payments
    path('rides/confirm-cash-otp/', ConfirmCashPaymentView.as_view(), name='confirm_cash_otp'),

    # Driver Actions
    path('driver/status/', DriverStatusView.as_view(), name='driver_status'),
    path('driver/ride-requests/', DriverRideFeedView.as_view(), name='driver_ride_feed'),
    path('driver/accept-ride/<int:ride_id>/', DriverAcceptRideView.as_view(), name='driver_accept_ride'),
    path('driver/update-ride/<int:ride_id>/', DriverUpdateRideStatusView.as_view(), name='driver_update_ride'),
    path('driver/earnings/', DriverEarningsView.as_view(), name='driver_earnings'),
    path('driver/withdraw/', WithdrawalRequestView.as_view(), name='driver_withdraw'),

    # Driver AI Demand Recommendations (GRAP Innovation)
    path('driver/ai-recommendations/', DriverAIDemandRecommendationsView.as_view(), name='driver_ai_recommendations'),

    # Admin Endpoints
    path('admin/drivers/', AdminDriverVerificationView.as_view(), name='admin_drivers'),
    path('admin/vehicles/', AdminVehicleVerificationView.as_view(), name='admin_vehicles'),
    path('admin/metrics/', AdminSystemMetricsView.as_view(), name='admin_metrics'),
]
