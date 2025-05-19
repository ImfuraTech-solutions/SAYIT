const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');
const Agency = require('../models/Agency');
const StandardUserNotification = require('../models/StandardUserNotification');
const AnonymousUserNotification = require('../models/AnonymousUserNotification');
const { authMiddleware, standardUserAuthMiddleware, anonymousAuthMiddleware, agentAuthMiddleware, adminAuthMiddleware } = require('../middleware/auth');

/**
 * @route   POST /api/feedback
 * @desc    Submit feedback for a complaint
 * @access  User authenticated (standard or anonymous)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      complaintId,
      satisfactionLevel,
      comment,
      responseTimeRating,
      staffProfessionalismRating,
      resolutionSatisfactionRating,
      communicationRating,
      wouldRecommend,
      isPublic
    } = req.body;

    // Validate complaint exists
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Verify user owns the complaint
    const userType = req.user.role === 'citizen' ? 'standard' : 'anonymous';
    if (
      (userType === 'standard' && complaint.standardUser.toString() !== req.user.id) ||
      (userType === 'anonymous' && complaint.anonymousUser.toString() !== req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to submit feedback for this complaint'
      });
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({ complaint: complaintId });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this complaint'
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      complaint: complaintId,
      submissionType: userType,
      standardUser: userType === 'standard' ? req.user.id : undefined,
      anonymousUser: userType === 'anonymous' ? req.user.id : undefined,
      satisfactionLevel,
      comment,
      responseTimeRating,
      staffProfessionalismRating,
      resolutionSatisfactionRating,
      communicationRating,
      wouldRecommend,
      isPublic: isPublic === true
    });

    // Notify agency about new feedback if satisfaction level is low
    if (satisfactionLevel <= 2 && complaint.agency) {
      // Logic to notify agency about low satisfaction feedback
      // This could be implemented in a separate notification system
    }

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Thank you for your feedback'
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   GET /api/feedback/complaint/:id
 * @desc    Get feedback by complaint ID
 * @access  User authenticated (standard or anonymous) or agency staff
 */
router.get('/complaint/:id', authMiddleware, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check authorization
    const isAuthorized = 
      (req.user.role === 'citizen' && complaint.standardUser && complaint.standardUser.toString() === req.user.id) ||
      (req.user.role === 'anonymous' && complaint.anonymousUser && complaint.anonymousUser.toString() === req.user.id) ||
      (req.user.role === 'agent' && complaint.agency && complaint.agency.toString() === req.user.agencyId) ||
      ['admin', 'supervisor', 'moderator', 'analyst'].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this feedback'
      });
    }

    const feedback = await Feedback.findByComplaint(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'No feedback found for this complaint'
      });
    }

    res.status(200).json({
      success: true,
      data: feedback
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/feedback/:id/agency-response
 * @desc    Add agency response to feedback
 * @access  Agent or admin only
 */
router.post('/:id/agency-response', agentAuthMiddleware, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Check if agency agent is authorized
    const complaint = await Complaint.findById(feedback.complaint);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Associated complaint not found'
      });
    }

    const isAuthorized = 
      (req.user.role === 'agent' && complaint.agency && complaint.agency.toString() === req.user.agencyId) ||
      ['admin', 'supervisor'].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this feedback'
      });
    }

    const { content } = req.body;
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Response content is required'
      });
    }

    await feedback.addAgencyResponse(
      content, 
      req.user.id, 
      req.user.role === 'agent' ? 'agent' : 'staff'
    );

    // Create notification for the user
    if (feedback.submissionType === 'standard') {
      await StandardUserNotification.createSystemNotification(
        feedback.standardUser,
        'Agency Responded to Your Feedback',
        `The agency has responded to your feedback on complaint "${complaint.title}".`,
        'normal',
        [{
          label: 'View Response',
          url: `/dashboard/complaints/${complaint._id}/feedback`
        }]
      );
    } else {
      await AnonymousUserNotification.createSystemNotification(
        feedback.anonymousUser,
        'Agency Responded to Your Feedback',
        `The agency has responded to your feedback on complaint "${complaint.title}".`,
        'normal',
        [{
          label: 'View Response',
          url: `/anonymous/complaints/${complaint._id}/feedback`
        }]
      );
    }

    res.status(200).json({
      success: true,
      data: feedback,
      message: 'Response added successfully'
    });

  } catch (error) {
    console.error('Error adding agency response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add agency response',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   GET /api/feedback/agency/:agencyId
 * @desc    Get all feedback for an agency
 * @access  Agency agents or admin
 */
router.get('/agency/:agencyId', agentAuthMiddleware, async (req, res) => {
  try {
    // Verify the user has access to this agency's data
    const isAuthorized = 
      (req.user.role === 'agent' && req.user.agencyId === req.params.agencyId) ||
      ['admin', 'supervisor', 'analyst'].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this agency feedback'
      });
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const feedbackList = await Feedback.find()
      .populate({
        path: 'complaint',
        match: { agency: req.params.agencyId },
        select: 'title trackingId status'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter out null complaints (those not belonging to the agency)
    const filteredFeedback = feedbackList.filter(feedback => feedback.complaint);

    // Count total records for pagination
    const totalCount = await Feedback.countDocuments().populate({
      path: 'complaint',
      match: { agency: req.params.agencyId }
    });

    res.status(200).json({
      success: true,
      count: filteredFeedback.length,
      data: filteredFeedback,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching agency feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agency feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   GET /api/feedback/analytics
 * @desc    Get feedback analytics
 * @access  Admin only
 */
router.get('/analytics', adminAuthMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, agencyId } = req.query;
    
    // Build match query for aggregation
    const matchQuery = {};
    
    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // If agency filter is provided
    if (agencyId) {
      // We need to first get all complaints for this agency
      const agencyComplaints = await Complaint.find({ agency: agencyId }).select('_id');
      const complaintIds = agencyComplaints.map(c => c._id);
      matchQuery.complaint = { $in: complaintIds };
    }
    
    // Run aggregation pipeline
    const [
      satisfactionStats,
      ratingStats,
      recommendationStats,
      timelineData
    ] = await Promise.all([
      // Average satisfaction by level
      Feedback.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$satisfactionLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      
      // Average ratings
      Feedback.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTimeRating' },
            avgProfessionalism: { $avg: '$staffProfessionalismRating' },
            avgResolution: { $avg: '$resolutionSatisfactionRating' },
            avgCommunication: { $avg: '$communicationRating' },
            avgOverall: { $avg: '$satisfactionLevel' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Recommendation stats
      Feedback.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$wouldRecommend', count: { $sum: 1 } } }
      ]),
      
      // Feedback over time (monthly)
      Feedback.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            avgSatisfaction: { $avg: '$satisfactionLevel' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);
    
    // Format satisfaction stats
    const satisfactionData = Array(5).fill(0);
    satisfactionStats.forEach(stat => {
      satisfactionData[stat._id - 1] = stat.count;
    });
    
    // Format recommendation stats
    const recommendationData = {
      yes: 0,
      no: 0,
      notSpecified: 0
    };
    
    recommendationStats.forEach(stat => {
      if (stat._id === true) recommendationData.yes = stat.count;
      else if (stat._id === false) recommendationData.no = stat.count;
      else recommendationData.notSpecified = stat.count;
    });
    
    // Format timeline data
    const formattedTimelineData = timelineData.map(item => ({
      year: item._id.year,
      month: item._id.month,
      avgSatisfaction: item.avgSatisfaction,
      count: item.count
    }));
    
    res.status(200).json({
      success: true,
      data: {
        satisfactionDistribution: satisfactionData,
        ratings: ratingStats[0] || {
          avgResponseTime: 0,
          avgProfessionalism: 0,
          avgResolution: 0,
          avgCommunication: 0,
          avgOverall: 0,
          count: 0
        },
        recommendation: recommendationData,
        timeline: formattedTimelineData
      }
    });
    
  } catch (error) {
    console.error('Error fetching feedback analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

module.exports = router;